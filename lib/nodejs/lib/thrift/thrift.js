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

/*jshint evil:true*/

var util = require('util');

/**
 * The Thrift namespace houses the Apache Thrift JavaScript library 
 * elements providing JavaScript bindings for the Apache Thrift RPC 
 * system. End users will typically only directly make use of the 
 * Transport (TXHRTransport/TWebSocketTransport) and Protocol 
 * (TJSONPRotocol/TBinaryProtocol) constructors.
 * 
 * Object methods beginning with a __ (e.g. __onOpen()) are internal 
 * and should not be called outside of the object's own methods.
 * 
 * This library creates one global object: Thrift
 * Code in this library must never create additional global identifiers,
 * all features must be scoped within the Thrift namespace.
 * @namespace
 * @example
 *     var transport = new Thrift.Transport("http://localhost:8585");
 *     var protocol  = new Thrift.Protocol(transport);
 *     var client = new MyThriftSvcClient(protocol);
 *     var result = client.MyMethod();
 */

/**
 * Thrift JavaScript library version.
 * @readonly
 * @const {string} Version
 * @memberof Thrift
 */
var Version = exports.Version = '1.0.0-dev';

/**
 * Thrift IDL type string to Id mapping.
 * @readonly
 * @property {number}  STOP   - End of a set of fields.
 * @property {number}  VOID   - No value (only legal for return types).
 * @property {number}  BOOL   - True/False integer.
 * @property {number}  BYTE   - Signed 8 bit integer.
 * @property {number}  I08    - Signed 8 bit integer.     
 * @property {number}  DOUBLE - 64 bit IEEE 854 floating point.
 * @property {number}  I16    - Signed 16 bit integer.
 * @property {number}  I32    - Signed 32 bit integer.
 * @property {number}  I64    - Signed 64 bit integer.
 * @property {number}  STRING - Array of bytes representing a string of characters.
 * @property {number}  UTF7   - Array of bytes representing a string of UTF7 encoded characters.
 * @property {number}  STRUCT - A multifield type.
 * @property {number}  MAP    - A collection type (map/associative-array/dictionary).
 * @property {number}  SET    - A collection type (unordered and without repeated values).
 * @property {number}  LIST   - A collection type (unordered).
 * @property {number}  UTF8   - Array of bytes representing a string of UTF8 encoded characters.
 * @property {number}  UTF16  - Array of bytes representing a string of UTF16 encoded characters.
 */
var Type = exports.Type = {
  STOP: 0,
  VOID: 1,
  BOOL: 2,
  BYTE: 3,
  I08: 3,
  DOUBLE: 4,
  I16: 6,
  I32: 8,
  I64: 10,
  STRING: 11,
  UTF7: 11,
  STRUCT: 12,
  MAP: 13,
  SET: 14,
  LIST: 15,
  UTF8: 16,
  UTF16: 17,
};

/**
 * Thrift RPC message type string to Id mapping.
 * @readonly
 * @property {number}  CALL      - RPC call sent from client to server.
 * @property {number}  REPLY     - RPC call normal response from server to client.
 * @property {number}  EXCEPTION - RPC call exception response from server to client.
 * @property {number}  ONEWAY    - Oneway RPC call from client to server with no response.
 */
exports.MessageType = {
  CALL: 1,
  REPLY: 2,
  EXCEPTION: 3,
  ONEWAY: 4,
};

/**
 * Initializes a Thrift TException instance.
 * @constructor
 * @augments Error
 * @param {string} message - The TException message (distinct from the Error message).
 * @classdesc TException is the base class for all Thrift exceptions types.
 */
var TException = exports.TException = function(message) {
  Error.call(this, message);
  this.name = 'TException';
};
util.inherits(TException, Error);

/**
 * Thrift Application Exception type string to Id mapping.
 * @readonly
 * @property {number}  UNKNOWN                 - Unknown/undefined.
 * @property {number}  UNKNOWN_METHOD          - Client attempted to call a method unknown to the server.
 * @property {number}  INVALID_MESSAGE_TYPE    - Client passed an unknown/unsupported MessageType.
 * @property {number}  WRONG_METHOD_NAME       - Unused.
 * @property {number}  BAD_SEQUENCE_ID         - Unused in Thrift RPC, used to flag proprietary sequence number errors.
 * @property {number}  MISSING_RESULT          - Raised by a server processor if a handler fails to supply the required return result.
 * @property {number}  INTERNAL_ERROR          - Something bad happened.
 * @property {number}  PROTOCOL_ERROR          - The protocol layer failed to serialize or deserialize data.
 * @property {number}  INVALID_TRANSFORM       - Unused.
 * @property {number}  INVALID_PROTOCOL        - The protocol (or version) is not supported.
 * @property {number}  UNSUPPORTED_CLIENT_TYPE - Unused.
 */
var TApplicationExceptionType = exports.TApplicationExceptionType = {
  UNKNOWN: 0,
  UNKNOWN_METHOD: 1,
  INVALID_MESSAGE_TYPE: 2,
  WRONG_METHOD_NAME: 3,
  BAD_SEQUENCE_ID: 4,
  MISSING_RESULT: 5,
  INTERNAL_ERROR: 6,
  PROTOCOL_ERROR: 7,
  INVALID_TRANSFORM: 8,
  INVALID_PROTOCOL: 9,
  UNSUPPORTED_CLIENT_TYPE: 10
};

var TApplicationException = exports.TApplicationException = function(type, message) {
  TException.call(this, message);
  this.type = type || TApplicationExceptionType.UNKNOWN;
  this.name = 'TApplicationException';
};
util.inherits(TApplicationException, TException);

/**
 * Read a TApplicationException from the supplied protocol.
 * @param {object} input - The input protocol to read from.
 */
TApplicationException.prototype.read = function(input) {
  var ftype;
  var ret = input.readStructBegin('TApplicationException');

  while(1){
      ret = input.readFieldBegin();
      if(ret.ftype == Type.STOP)
          break;

      switch(ret.fid){
          case 1:
              if( ret.ftype == Type.STRING ){
                  ret = input.readString();
                  this.message = ret;
              } else {
                  ret = input.skip(ret.ftype);
              }
              break;
          case 2:
              if( ret.ftype == Type.I32 ){
                  ret = input.readI32();
                  this.type = ret;
              } else {
                  ret   = input.skip(ret.ftype);
              }
              break;
          default:
              ret = input.skip(ret.ftype);
              break;
      }
      input.readFieldEnd();
  }
  input.readStructEnd();
};

/**
 * Wite a TApplicationException to the supplied protocol.
 * @param {object} output - The output protocol to write to.
 */
TApplicationException.prototype.write = function(output){
  output.writeStructBegin('TApplicationException');

  if (this.message) {
      output.writeFieldBegin('message', Type.STRING, 1);
      output.writeString(this.message);
      output.writeFieldEnd();
  }

  if (this.code) {
      output.writeFieldBegin('type', Type.I32, 2);
      output.writeI32(this.code);
      output.writeFieldEnd();
  }

  output.writeFieldStop();
  output.writeStructEnd();
};

var TProtocolExceptionType = exports.TProtocolExceptionType = {
  UNKNOWN: 0,
  INVALID_DATA: 1,
  NEGATIVE_SIZE: 2,
  SIZE_LIMIT: 3,
  BAD_VERSION: 4,
  NOT_IMPLEMENTED: 5,
  DEPTH_LIMIT: 6
}


var TProtocolException = exports.TProtocolException = function(type, message) {
  Error.call(this, message);
  this.name = 'TProtocolException';
  this.type = type;
};
util.inherits(TProtocolException, Error);


var CallOnce = exports.CallOnce = function CallOnce(cb) {
    if(!(this instanceof CallOnce)) return new CallOnce(cb);

    this.called = false;
    this.cb = cb;
    var self = this;

    return function CallOnceCb() {
        if (!self.called) {
          // TODO maybe leaking arguments here
          // TODO process nextTick
          return self.cb.apply(this, arguments);
        }
        //TODO maybe add logging of double calls
    };
};


/**
 * Utility function returning the count of an object's own properties.
 * @param {object} obj - Object to test.
 * @returns {number} number of object's own properties
 */
exports.objectLength = function(obj) {
  return Object.keys(obj).length;
};

// This objectLength function was taken from the JS version. Should we use it
// instead of the NodeJS version above?
// function objectLength(obj) {
//     var length = 0;
//     for (var k in obj) {
//         if (obj.hasOwnProperty(k)) {
//             length++;
//         }
//     }
//     return length;
// };

/**
 * Utility function to establish prototype inheritance.
 * @see {@link http://javascript.crockford.com/prototypal.html|Prototypal Inheritance}
 * @param {function} constructor - Contstructor function to set as derived.
 * @param {function} superConstructor - Contstructor function to set as base.
 * @param {string} [name] - Type name to set as name property in derived prototype.
 */
exports.inherits = function(constructor, superConstructor) {
  util.inherits(constructor, superConstructor);
};

// This inherits function was taken from the JS version. Should we use it
// instead of the NodeJS version above?
function inherits(constructor, superConstructor, name) {
  function F() {}
  F.prototype = superConstructor.prototype;
  constructor.prototype = new F();
  constructor.prototype.name = name || "";
}