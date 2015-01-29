#! /bin/sh

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

if [ -n "${1}" ]; then
  COVER=${1};
fi

DIR="$( cd "$( dirname "$0" )" && pwd )"

COUNT=0

export NODE_PATH="${DIR}:${DIR}/../lib:${NODE_PATH}"

testServer()
{
  echo "   Testing $1 Client/Server with protocol $2 and transport $3 $4";
  RET=0
  if [ -n "${COVER}" ]; then
    ${DIR}/../node_modules/.bin/istanbul cover ${DIR}/server.js --dir ${DIR}/../coverage/report${COUNT} --handle-sigint -- --type $1 -p $2 -t $3 $4 &
    ((COUNT++))
  else
    node ${DIR}/server.js --type $1 -p $2 -t $3 $4 &
  fi
  SERVERPID=$!
  sleep 1
  if [ -n "${COVER}" ]; then
    ${DIR}/../node_modules/.bin/istanbul cover ${DIR}/client.js --dir ${DIR}/../coverage/report${COUNT} -- --type $1 -p $2 -t $3 $4 || RET=1
    ((COUNT++))
  else
    node ${DIR}/client.js --type $1 -p $2 -t $3 $4 || RET=1
  fi
  kill -2 $SERVERPID || RET=1
  return $RET
}

TESTOK=0

#generating thrift code

${DIR}/../../../compiler/cpp/thrift -o ${DIR} --gen js:node ${DIR}/../../../test/ThriftTest.thrift

#unit tests

node ${DIR}/binary.test.js || TESTOK=1

#integration tests

#TCP connection tests
testServer tcp compact buffered || TESTOK=1
testServer tcp compact framed || TESTOK=1
testServer tcp binary buffered || TESTOK=1
testServer tcp json buffered || TESTOK=1
testServer tcp binary framed || TESTOK=1
testServer tcp json framed || TESTOK=1

# #tests for multiplexed services
testServer multiplex binary buffered || TESTOK=1
testServer multiplex json buffered || TESTOK=1
testServer multiplex binary framed || TESTOK=1
testServer multiplex compact framed || TESTOK=1

# #test ssl connection
testServer tcp binary framed --ssl || TESTOK=1
testServer multiplex binary framed --ssl || TESTOK=1

# #test promise style
testServer tcp binary framed --promise || TESTOK=1
testServer tcp compact buffered --promise || TESTOK=1

# #HTTP tests
testServer http compact buffered || TESTOK=1
testServer http compact framed || TESTOK=1
testServer http json buffered || TESTOK=1
testServer http json framed || TESTOK=1
testServer http binary buffered || TESTOK=1
testServer http binary framed || TESTOK=1
testServer http json buffered --promise || TESTOK=1
testServer http binary framed --ssl || TESTOK=1

if [ -n "${COVER}" ]; then
  ${DIR}/../node_modules/.bin/istanbul report --include "${DIR}/../coverage/report*/coverage.json" lcov cobertura
  rm -r ${DIR}/../coverage/report*/*
  rmdir ${DIR}/../coverage/report*
fi

exit $TESTOK
