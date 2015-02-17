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
var WebSocketServer = require('ws').Server;

var MultiplexedProcessor = require('./multiplexed_processor').MultiplexedProcessor;

var TBufferedTransport = require('./buffered_transport');
var TBinaryProtocol = require('./binary_protocol');
var InputBufferUnderrunError = require('./input_buffer_underrun_error');

module.exports.thriftPostHandler = thriftPostHandler;
module.exports.ThriftWebsocketServer = ThriftWebsocketServer;
module.exports.normalizeServices = normalizeServices;

function normalizeService(service) {
  //Setup the processor
  if (service.processor instanceof MultiplexedProcessor) {
    // Multiplex processors have pre embedded processor/handler
    // pairs, save as is:
    service.processor = service.processor;
  } else {
    // For historical reasons Node.js supports processors passed
    // in directly or via the IDL Compiler generated class housing
    // the processor. Also, the options property for a Processor
    // has been called both cls and processor at different times.
    // We support any of the four possibilities here.
    var processor = service.processor || service.cls;
    processor = processor.Processor || processor;

    // Processors can be supplied as constructed objects with
    // handlers already embedded, if a handler is provided we
    // construct a new processor, if not we use the processor
    // object directly:
    service.processor = service.handler ?
      new processor(service.handler) : processor;
  }
}

function makeOnDataFn(service, onWriteFn, onErrFn) {

  var processor = service.processor;
  var transport = service.transport ? service.transport : TBufferedTransport;
  var protocol = service.protocol ? service.protocol : TBinaryProtocol;

  function onData(transportWithData) {
    var input = new protocol(transportWithData);
    var output = new protocol(new transport(undefined, onWriteFn));

    try {
      processor.process(input, output);
      transportWithData.commitPosition();
    } catch (err) {
      if (err instanceof InputBufferUnderrunError) {
        transportWithData.rollbackPosition();
      }
      if (onErrFn) {
        onErrFn(err);
      }
    }
  }

  return transport.receiver(onData);
}

function addWebSocketServer(server, route, service) {
  var wss = new WebSocketServer({
    server: server,
    path: route
  });

  wss.on('connection', function(ws) {
    var onMessage = makeOnDataFn(service, onWSWrite, onWSError);
    ws.on('message', onMessage);

    function onWSError(err) {
      console.log(err);
      console.log(err.stack);
    }

    function onWSWrite(buf) {
      ws.send(buf);
    }
  });

  return wss;
}

// Handle POST methods (TXHRTransport)
function thriftPostHandler(service) {

  function processPost(request, response, next) {
    var onData = makeOnDataFn(service, onXHRwrite, next);
    // Process XHR payload
    request.on('data', onData);

    function onXHRwrite(buf) {
      response.writeHead(200);
      response.end(buf);
    }
  }

  return processPost;
}

function normalizeServices(services) {
  Object.keys(services).forEach(function(route) {
    normalizeService(services[route]);
  });
  return services;
}

function ThriftWebsocketServer(server, services) {
  Object.keys(services).forEach(function(route) {
    var service = services[route];
    var wss = addWebSocketServer(server, route, service);
  });
}
