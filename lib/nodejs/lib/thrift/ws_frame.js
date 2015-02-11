/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// WSFrame constructor and prototype
/////////////////////////////////////////////////////////////////////

/** Apache Thrift RPC Web Socket Transport
 *  Frame layout conforming to RFC 6455 circa 12/2011
 *
 * Theoretical frame size limit is 4GB*4GB, however the Node Buffer
 * limit is 1GB as of v0.10. The frame length encoding is also
 * configured for a max of 4GB presently and needs to be adjusted
 * if Node/Browsers become capabile of > 4GB frames.
 *
 *  - FIN is 1 if the message is complete
 *  - RSV1/2/3 are always 0
 *  - Opcode is 1(TEXT) for TJSONProtocol and 2(BIN) for TBinaryProtocol
 *  - Mask Present bit is 1 sending to-server and 0 sending to-client
 *  - Payload Len:
 *        + If < 126: then represented directly
 *        + If >=126: but within range of an unsigned 16 bit integer
 *             then Payload Len is 126 and the two following bytes store
 *             the length
 *        + Else: Payload Len is 127 and the following 8 bytes store the
 *             length as an unsigned 64 bit integer
 *  - Masking key is a 32 bit key only present when sending to the server
 *  - Payload follows the masking key or length
 *
 *     0                   1                   2                   3
 *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *    +-+-+-+-+-------+-+-------------+-------------------------------+
 *    |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 *    |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 *    |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 *    | |1|2|3|       |K|             |                               |
 *    +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 *    |     Extended payload length continued, if payload len == 127  |
 *    + - - - - - - - - - - - - - - - +-------------------------------+
 *    |                               |Masking-key, if MASK set to 1  |
 *    +-------------------------------+-------------------------------+
 *    | Masking-key (continued)       |          Payload Data         |
 *    +-------------------------------- - - - - - - - - - - - - - - - +
 *    :                     Payload Data continued ...                :
 *    + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 *    |                     Payload Data continued ...                |
 *    +---------------------------------------------------------------+
 */

module.exports.encode = encodeWebSocketFrame;
module.exports.decode = decodeWebSocketFrame;

var FRAME_CONT_OPCODE = 0x00;
var FRAME_TEXT_OPCODE = 0x01;
var FRAME_BIN_OPCODE = 0x02;
var FRAME_CTRL_OPCODE = 0x80;
var MASK_TO_SERVER = 0x80;
var MASK_TO_CLIENT = 0x00;
var FIN_CONT = 0x00;
var FIN_FIN = 0x80;
var FINCTRL = undefined;

/** Masks/Unmasks data
 *
 * @param {Buffer} data - data to mask/unmask in place
 * @param {Buffer} mask - the mask
 */
function applyMask(data, mask){
  //TODO: look into xoring words at a time
  var dataLen = data.length;
  var maskLen = mask.length;
  for (var i = 0; i < dataLen; i++) {
    data[i] = data[i] ^ mask[i % maskLen];
  }
}

/**
 * @class
 * @name WSDecodeResult
 * @property {Buffer} data - The decoded data for the first ATRPC message
 * @property {Buffer} mask - The frame mask
 * @property {Boolean} binEncoding - True if binary (TBinaryProtocol),
 *                                   False if text (TJSONProtocol)
 * @property {Buffer} nextFrame - Multiple ATRPC messages may be sent in a
 *                                single WebSocket frame, this Buffer contains
 *                                any bytes remaining to be decoded
 * @property {Boolean} FIN - True is the message is complete
 */

 /** Decodes a WebSocket frame
 *
 * @param {Buffer} frame - The raw inbound frame, if this is a continuation
 *                         frame it must have a mask property with the mask.
 * @returns {WSDecodeResult} - The decoded payload
 *
 * @see {@link WSDecodeResult}
 */
function decodeWebSocketFrame(frame) {
  var data = null;
  var mask = null;
  var nextFrame = frame;
  var FIN = false;
  var binEncoding;

  while (nextFrame && !FIN) {

    // Byte 0 - FIN & OPCODE
    FIN = (FIN_FIN != (nextFrame[0] & FIN_FIN)) ? false : true;
    binEncoding = (FRAME_BIN_OPCODE == (nextFrame[0] & FRAME_BIN_OPCODE));

    //Byte 1 or 1-3 or 1-9 - SIZE
    var lenByte = (nextFrame[1] & 0x0000007F);
    var dataLength = lenByte;
    var dataOffset = 2;
    if (lenByte == 0x7E) {
      dataLength = nextFrame.readUInt16BE(2);
      dataOffset = 4;
    } else if (lenByte == 0x7F) {
      dataLength = nextFrame.readUInt32BE(6);
      dataOffset = 10;
    }
    //MASK
    if (MASK_TO_SERVER == (nextFrame[1] & MASK_TO_SERVER)) {
      mask = nextFrame.slice(dataOffset, dataOffset + 4);
      dataOffset += 4;
    }
    //Payload
    var dataEndPos = dataOffset + dataLength;
    newData = nextFrame.slice(dataOffset, dataEndPos);

    if (mask) {
      applyMask(newData, mask);
    }

    //Don't forward control frames
    if (nextFrame[0] & FINCTRL) {
      newData = null;
    }

    data = data ?
      Buffer.concat([data, newData], data.length + newData.length) :
      newData;

    //Next Frame
    nextFrame = (nextFrame.length > dataEndPos) ?
      nextFrame.slice(dataEndPos, nextFrame.length) : null;
  }

  return {
    data: data,
    binEncoding: binEncoding,
    nextFrame: nextFrame
  };
}


/** Computes frame size on the wire from data to be sent
 *
 * @param {Buffer} data - data.length is the assumed payload size
 * @param {Boolean} mask - true if a mask will be sent (TO_SERVER)
 */
function frameSizeFromData(data, mask) {
  var headerSize = 10;
  if (data.length < 0x7E) {
    headerSize = 2;
  } else if (data.length < 0xFFFF) {
    headerSize = 4;
  }
  return headerSize + data.length + (mask ? 4 : 0);
}

/** Encodes a WebSocket frame
 *
 * @param {Buffer} data - The raw data to encode
 * @param {Buffer} mask - The mask to apply when sending to server, null for no mask
 * @param {Boolean} binEncoding - True for binary encoding, false for text encoding
 * @returns {Buffer} - The WebSocket frame, ready to send
 */
function encodeWebSocketFrame(data, mask, binEncoding) {
  var frame = new Buffer(frameSizeFromData(data, mask));

  //Byte 0 - FIN & OPCODE
  frame[0] = FIN_FIN +
      (binEncoding ? FRAME_BIN_OPCODE : FRAME_TEXT_OPCODE);

  //Byte 1 or 1-3 or 1-9 - MASK FLAG & SIZE
  var payloadOffset;
  var maskOpcode = mask ? MASK_TO_SERVER : MASK_TO_CLIENT;

  if (data.length < 0x7E) {
    frame[1] = data.length + maskOpcode;
    payloadOffset = 2;
  } else if (data.length < 0xFFFF) {
    frame[1] = 0x7E + maskOpcode;
    frame.writeUInt16BE(data.length, 2, true);
    payloadOffset = 4;
  } else {
    frame[1] = 0x7F + maskOpcode;
    frame.writeUInt32BE(0, 2, true);
    frame.writeUInt32BE(data.length, 6, true);
    payloadOffset = 10;
  }
  //MASK
  if (mask) {
    mask.copy(frame, payloadOffset, 0, 4);
    payloadOffset += 4;
  }
  //Payload
  data.copy(frame, payloadOffset);
  if (mask) {
    applyMask(frame.slice(payloadOffset), mask);
  }
  return frame;
}
