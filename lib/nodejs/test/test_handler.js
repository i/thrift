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

//This is the server side Node test handler for the standard
//  Apache Thrift test service.

var ttypes = require('./gen-nodejs/ThriftTest_types');
var TException = require('thrift').Thrift.TException;
var syncHandlers = require('./test_handler_promise');

function makeHandler(label) {
  return function(thing, result) {
    thing = syncHandlers.ThriftTestHandler[label](thing);
    result(null, thing);
  }
}

exports.ThriftTestHandler = {
  testVoid: function(result) {
    console.log('testVoid()');
    result(null);
  },
  testString: makeHandler('testString'),
  testByte: makeHandler('testByte'),
  testI32: makeHandler('testI32'),
  testI64: makeHandler('testI64'),
  testDouble: makeHandler('testDouble'),
  testStruct: makeHandler('testStruct'),
  testNest: makeHandler('testNest'),
  testMap: makeHandler('testMap'),
  testStringMap: makeHandler('testStringMap'),
  testSet: makeHandler('testSet'),
  testList: makeHandler('testList'),
  testEnum: makeHandler('testEnum'),
  testTypedef: makeHandler('testTypedef'),
  testMapMap: makeHandler('testMapMap'),
  testInsanity: makeHandler('testInsanity'),
  testMulti: function(arg0, arg1, arg2, arg3, arg4, arg5, result) {
    console.log('testMulti()');

    var hello = new ttypes.Xtruct();
    hello.string_thing = 'Hello2';
    hello.byte_thing = arg0;
    hello.i32_thing = arg1;
    hello.i64_thing = arg2;
    result(null, hello);
  },
  testException: function(arg, result) {
    console.log('testException('+arg+')');
    if (arg === 'Xception') {
      var x = new ttypes.Xception();
      x.errorCode = 1001;
      x.message = arg;
      result(x);
    } else if (arg === 'TException') {
      result(new TException(arg));
    } else {
      result(null);
    }
  },
  testMultiException: function(arg0, arg1, result) {
    console.log('testMultiException(' + arg0 + ', ' + arg1 + ')');
    if (arg0 === ('Xception')) {
      var x = new ttypes.Xception();
      x.errorCode = 1001;
      x.message = 'This is an Xception';
      result(x);
    } else if (arg0 === ('Xception2')) {
      var x2 = new ttypes.Xception2();
      x2.errorCode = 2002;
      x2.struct_thing = new ttypes.Xtruct();
      x2.struct_thing.string_thing = 'This is an Xception2';
      result(x2);
    }

    var res = new ttypes.Xtruct();
    res.string_thing = arg1;
    result(null, res);
  },
  testOneway: function(sleepFor, result) {
    console.log('testOneway(' + sleepFor + ') => JavaScript (like Rust) never sleeps!');
  }
};
