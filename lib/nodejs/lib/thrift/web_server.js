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
var http = require('http');
var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');
var cors = require('cors');

var WebMiddleware = require('./web_middleware');
var ThriftWebsocketServer = WebMiddleware.ThriftWebsocketServer;
var thriftPostHandler = WebMiddleware.thriftPostHandler;
var normalizeServices = WebMiddleware.normalizeServices;

/**
 * @class
 * @name ServerOptions
 * @property {array} cors - Array of CORS origin strings to permit requests from.
 * @property {string} files - Path to serve static files from, if absent or ""
 *                               static file service is disabled.
 * @property {object} headers - An object hash mapping header strings to header value
 *                              strings, these headers are transmitted in response to
 *                              static file GET operations.
 * @property {object} services - An object hash mapping service URI strings
 *                               to ServiceOptions objects
 * @property {object} tls - Node.js TLS options (see: nodejs.org/api/tls.html),
 *                          if not present or null regular http is used,
 *                          at least a key and a cert must be defined to use SSL/TLS
 * @see {@link ServiceOptions}
 */

/**
 * @class
 * @name ServiceOptions
 * @property {object} transport - The layered transport to use (defaults
 *                                to TBufferedTransport).
 * @property {object} protocol - The serialization Protocol to use (defaults to
 *                               TBinaryProtocol).
 * @property {object} processor - The Thrift Service class/processor generated
 *                                by the IDL Compiler for the service (the "cls"
 *                                key can also be used for this attribute).
 * @property {object} handler - The handler methods for the Thrift Service.
 */

/**
 * Create a Thrift server which can serve static files and/or one or
 * more Thrift Services.
 * @param {ServerOptions} options - The server configuration.
 * @returns {object} - The Apache Thrift Web Server.
 */
exports.createWebServer = function(options) {

  var services = normalizeServices(options.services);

  function postHandler(request, response, next) {
    var route = url.parse(request.url).pathname;
    var service = services[route];
    if (!service) {
      return send404(request, response);
    }
    return thriftPostHandler(service)(request, response, next);
  }

  var methodHandlers = {
    'POST': postHandler,
    'GET': serveStatic(options)
  };

  function router(request, response) {
    var method = request.method;

    var handler = methodHandlers.hasOwnProperty(method) ?
      methodHandlers[method] : sendServerError;

    handler(request, response, function onError(err) {
      if (err) {
        console.log(err);
        console.log(err.stack);
        sendServerError(request, response);
      }
    });
  }

  var server = options.tls ?
    https.createServer(options.tls) : http.createServer();

  var corsMiddleware = cors(corsOptions(options.cors));

  server.on('request', function(request, response) {

    corsMiddleware(request, response, function(err) {
      if (err) {
        return sendCorsError(request, response);
      }
      return router(request, response);
    });

  });

  ThriftWebsocketServer(server, services);

  return server;
};

function sendServerError(request, response) {
  response.writeHead(500);
  response.end();
}

function sendCorsError(request, response) {
  response.writeHead("403", "Origin " + request.headers.origin + " not allowed", {});
  response.end();
}

function send404(request, response) {
  response.writeHead(404);
  response.end();
}

function corsOptions(cors) {
  var options = {
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'content-type, accept',
    maxAge: 60
  };

  if (Array.isArray(cors)) {
    options.origin = originCallback;
  } else if (typeof cors === 'function') {
    options.origin = cors;
  } else {
    options.origin = true;
  }

  return options;

  function originCallback(origin, callback) {
    var originIsWhitelisted = cors.indexOf(origin) !== -1;
    callback(null, originIsWhitelisted);
  }
}

function serveStatic(options) {
  var baseDir = options.files;

  var contentTypesByExtension = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.xml': 'application/xml',
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  function processGet(request, response) {
    //Undefined or empty base directory means do not serve static files
    if (!baseDir || "" === baseDir) {
      return send404(request, response);
    }

    //Locate the file requested and send it
    var uri = url.parse(request.url).pathname;
    var filename = path.join(baseDir, uri);
    fs.exists(filename, function(exists) {
      if(!exists) {
        return send404(request, response);
      }

      if (fs.statSync(filename).isDirectory()) {
        filename += '/index.html';
      }

      fs.readFile(filename, "binary", function(err, file) {
        if (err) {
          response.writeHead(500);
          response.end(err + "\n");
          return;
        }
        var headers = {};
        var contentType = contentTypesByExtension[path.extname(filename)];
        if (contentType) {
          headers["Content-Type"] = contentType;
        }
        for (var k in options.headers) {
          headers[k] = options.headers[k];
        }
        response.writeHead(200, headers);
        response.write(file, "binary");
        response.end();
      });
    });
  }

  return processGet;
}
