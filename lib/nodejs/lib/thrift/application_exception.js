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
var util = require('util');
var Type = require('./types');
var TException = require('./exception');

module.exports = TApplicationException;

var TApplicationExceptionType = {
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

function TApplicationException(type, message) {
  TException.call(this, message);
  this.type = type || TApplicationExceptionType.UNKNOWN;
  this.name = 'TApplicationException';
};
util.inherits(TApplicationException, TException);

TApplicationException.types = TApplicationExceptionType;

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
