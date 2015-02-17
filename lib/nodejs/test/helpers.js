'use strict';
var transports = require('thrift/transport');
var protocols = require('thrift/protocol');

module.exports.transports = {
  'buffered': transports.TBufferedTransport,
  'framed': transports.TFramedTransport
};

module.exports.protocols = {
  'json': protocols.TJSONProtocol,
  'binary': protocols.TBinaryProtocol,
  'compact': protocols.TCompactProtocol
};
