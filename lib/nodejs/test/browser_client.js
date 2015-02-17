
var assert = require('assert');
var ThriftXHR = require('thrift/xhr_connection');
//var ThriftWS = require('thrift/ws_connection');

var createThriftClient = require('thrift/create_client');

var helpers = require('./helpers');
var ThriftTest = require('./gen-nodejs/ThriftTest');
var ThriftTestDriver = require('./test_driver').ThriftTestDriver;

// ThriftXHR.createXHRConnection ThriftWS.createWSConnection
var connection = ThriftXHR.createXHRConnection("localhost", 9090, {
    transport: helpers.transports['buffered'],
    protocol: helpers.protocols['json'],
    path: '/test'
});

connection.on('error', function(err) {
    assert(false, err);
});

// Uncomment the following line to start a websockets connection
// connection.open();

var client = createThriftClient(ThriftTest, connection);

ThriftTestDriver(client, function (status) {
    console.log('Browser:', status);
});
