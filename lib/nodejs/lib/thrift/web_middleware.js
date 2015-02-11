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
var url = require("url");
var crypto = require("crypto");

var MultiplexedProcessor = require('./multiplexed_processor').MultiplexedProcessor;

var TBufferedTransport = require('./buffered_transport');
var TBinaryProtocol = require('./binary_protocol');
var InputBufferUnderrunError = require('./input_buffer_underrun_error');

var wsFrame = require('./ws_frame');

/*
 * RFC-6455 GUID
 *
 * This GUID was chosen by the standards committee because it is a
 * GUID that is unlikely to be used by network endpoints that do not
 * understand the WebSocket Protocol.
 *
 * http://tools.ietf.org/html/rfc6455
 */
var RFC_6455_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

module.exports = createMiddleware;

function createMiddleware(services) {
  // Object.keys(services).forEach(function (uri) {
  //   var svcObj = services[uri];

  // });

  for (var uri in services) {
    var svcObj = services[uri];

    //Setup the processor
    if (svcObj.processor instanceof MultiplexedProcessor) {
      // Multiplex processors have pre embedded processor/handler pairs, save as is
      // svcObj.processor = svcObj.processor;
    } else {
      //For historical reasons Node.js supports processors passed in directly or via the
      //  IDL Compiler generated class housing the processor. Also, the options property
      //  for a Processor has been called both cls and processor at different times. We
      //  support any of the four possibilities here.
      var processor = (svcObj.processor) ? (svcObj.processor.Processor || svcObj.processor) :
                                           (svcObj.cls.Processor || svcObj.cls);
      //Processors can be supplied as constructed objects with handlers already embedded,
      //  if a handler is provided we construct a new processor, if not we use the processor
      //  object directly
      svcObj.processor = svcObj.handler ? new processor(svcObj.handler) : processor;
    }
    svcObj.transport = svcObj.transport ? svcObj.transport : TBufferedTransport;
    svcObj.protocol = svcObj.protocol ? svcObj.protocol : TBinaryProtocol;
  }

  function makeOnDataFn(svc, onWriteFn, onErrFn) {
    return function onData(transportWithData) {
      var input = new svc.protocol(transportWithData);
      var output = new svc.protocol(new svc.transport(undefined, onWriteFn));

      try {
        svc.processor.process(input, output);
        transportWithData.commitPosition();
      } catch (err) {
        if (err instanceof InputBufferUnderrunError) {
          transportWithData.rollbackPosition();
        } else if (onErrFn) {
          onErrFn(request, response);
        }
      }
    }
  }

  //Handle POST methods (TXHRTransport)
  ///////////////////////////////////////////////////
  function processPost(request, response) {
    //Lookup service
    var uri = url.parse(request.url).pathname;
    var svc = services[uri];
    if (!svc) {
      response.writeHead("403", "No Apache Thrift Service at " + uri, {});
      response.end();
      return;
    }
    var onXHRError = makeOnXHRError();
    var xhrOnData = makeOnDataFn(svc, onXHRwrite, onXHRError);
    //Process XHR payload
    request.on('data', svc.transport.receiver(xhrOnData));

    function onXHRwrite(buf) {
      try {
        response.writeHead(200);
        response.end(buf);
      } catch (err) {
        onXHRError();
      }
    }

    function makeOnXHRError() {
      return function() {
        response.writeHead(500);
        response.end();
      }
    }
  }

  //Handle WebSocket calls (TWebSocketTransport)
  ///////////////////////////////////////////////////
  function processWS(data, socket, svc, binEncoding) {
    var wsOnData = makeOnDataFn(svc, onWSwrite);
    svc.transport.receiver(wsOnData)(data);

    function onWSwrite(buf) {
      try {
        var frame = wsFrame.encode(buf, null, binEncoding);
        socket.write(frame);
      } catch (err) {
        //TODO: Add better error processing
      }
    }
  }

  function upgradeHandler(request, socket, head) {
    //Lookup service
    var svc = services[request.url];
    if (!svc) {
      socket.write("HTTP/1.1 403 No Apache Thrift Service available\r\n\r\n");
      return;
    }

    //Perform upgrade
    var hash = crypto.createHash("sha1");
    hash.update(request.headers['sec-websocket-key'] + RFC_6455_GUID);
    socket.write("HTTP/1.1 101 Switching Protocols\r\n" +
                   "Upgrade: websocket\r\n" +
                   "Connection: Upgrade\r\n" +
                   "Sec-WebSocket-Accept: " + hash.digest("base64") + "\r\n" +
                   "Sec-WebSocket-Origin: " + request.headers.origin + "\r\n" +
                   "Sec-WebSocket-Location: ws://" + request.headers.host + request.url + "\r\n" +
                   "\r\n");
    //Handle WebSocket traffic
    socket.on('data', function(frame) {
      try {
        while (frame) {
          var result = wsFrame.decode(frame);
          processWS(result.data, socket, svc, result.binEncoding);
          frame = result.nextFrame;
        }
      } catch(e) {
        console.log("TWebSocketTransport Exception: " + e);
        console.log(e.stack);
        socket.destroy();
      }
    });
  }

  return {
    processPost: processPost,
    upgradeHandler: upgradeHandler
  };
}
