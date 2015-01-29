/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

 // This is the Node.js test driver for the standard Apache Thrift
 // test service. The driver invokes every function defined in the
 // Thrift Test service with a representative range of parameters.
 //
 // The ThriftTestDriver function requires a client object
 // connected to a server hosting the Thrift Test service and
 // supports an optional callback function which is called with
 // a status message when the test is complete.

var assert = require('assert');
var ttypes = require('./gen-nodejs/ThriftTest_types');
var Int64 = require('node-int64');
var testCases = require('./test-cases');
var testDriverHelpers = require('./test-driver-helpers');

function checkRecursively(map1, map2) {
  if (typeof map1 !== 'function' && typeof map2 !== 'function') {
    if (!map1 || typeof map1 !== 'object') {
      //Handle int64 types (which use node-int64 in Node.js JavaScript)
      if ((typeof map1 === "number") && (typeof map2 === "object") &&
          (map2.buffer) && (map2.buffer instanceof Buffer) && (map2.buffer.length === 8)) {
        var n = new Int64(map2.buffer);
        assert.equal(map1, n.toNumber());
      } else {
        assert.equal(map1, map2);
      }
    } else {
      for (var key in map1) {
        checkRecursively(map1[key], map2[key]);
      }
    }
  }
}

exports.ThriftTestDriver = function(client, callback) {

  function makeAsserter(assertionFn) {
    return function(c) {
      var fnName = c[0];
      var expected = c[1];
      client[fnName](expected, function(err, actual) {
        assert(!err);
        assertionFn(actual, expected);
      })
    };
  }

  testCases.simple.forEach(makeAsserter(assert.equal));
  testCases.deep.forEach(makeAsserter(assert.deepEqual));

  client.testStruct(testCases.out, function(err, response) {
    assert(!err);
    checkRecursively(testCases.out, response);
  });

  client.testNest(testCases.out2, function(err, response) {
    assert(!err);
    checkRecursively(testCases.out2, response);
  });

  client.testInsanity(testCases.crazy, function(err, response) {
    assert(!err);
    checkRecursively(testCases.insanity, response);
  });

  client.testException('TException', function(err, response) {
    assert(!err);
    assert(!response);
  });

  client.testException('Xception', function(err, response) {
    assert(!response);
    assert.equal(err.errorCode, 1001);
    assert.equal('Xception', err.message);
  });

  client.testException('no Exception', function(err, response) {
    assert(!err);
    assert.equal(undefined, response); //void
  });

  client.testOneway(0, function(err, response) {
    assert(false); //should not answer
  });

  testDriverHelpers.checkOffByOne(function(done) {
    client.testI32(-1, function(err, response) {
      assert(!err);
      assert.equal(-1, response);
      done();
    });
  }, callback);

};
