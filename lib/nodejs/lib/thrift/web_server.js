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
var url = require("url");
var path = require("path");
var fs = require("fs");

var createMiddleware = require('./web_middleware');

// createWebServer constructor and options
/////////////////////////////////////////////////////////////////////

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

  var middleware = createMiddleware(options.services);

  //Verify CORS requirements
  function VerifyCORSAndSetHeaders(request, response, next) {
    if (request.headers.origin && options.cors) {
      if (options.cors["*"] || options.cors[request.headers.origin]) {
        //Allow, origin allowed
        response.setHeader("access-control-allow-origin", request.headers.origin);
        response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
        response.setHeader("access-control-allow-headers", "content-type, accept");
        response.setHeader("access-control-max-age", "60");
      } else {
        //Disallow, origin denied
        response.writeHead("403", "Origin " + request.headers.origin + " not allowed", {});
        response.end();
      }
    }
    //Allow, CORS is not in use
    next(request, response);
  }

  //Handle GET methods (Static Page Server)
  ///////////////////////////////////////////////////
  function processGet(request, response) {
    //Undefined or empty base directory means do not serve static files
    if (!baseDir || "" === baseDir) {
      response.writeHead(404);
      response.end();
      return;
    }

    //Locate the file requested and send it
    var uri = url.parse(request.url).pathname;
    var filename = path.join(baseDir, uri);
    fs.exists(filename, function(exists) {
      if(!exists) {
        response.writeHead(404);
        response.end();
        return;
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

  //Create the server (HTTP or HTTPS)
  var server = null;
  if (options.tls) {
    server = https.createServer(options.tls);
  } else {
    server = http.createServer();
  }

  function router(request, response) {
    if (request.method === 'POST') {
      middleware.processPost(request, response);
    } else if (request.method === 'GET') {
      processGet(request, response);
    } else if (request.method === 'OPTIONS') {
      response.writeHead("204", "No Content", {"content-length": 0});
      response.end();
    } else {
      response.writeHead(500);
      response.end();
    }
  }

  //Wire up listeners for upgrade(to WebSocket) & request methods for:
  //   - GET static files,
  //   - POST XHR Thrift services
  //   - OPTIONS CORS requests
  server.on('request', function(request, response) {
    VerifyCORSAndSetHeaders(request, response, router);
  }).on('upgrade', middleware.upgradeHandler);

  //Return the server
  return server;
};
