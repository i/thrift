'use strict';

var retry_limit = 30;
var retry_interval = 100;

module.exports.checkOffByOne = function checkOffByOne(done, callback) {

  var test_complete = false;
  var retrys = 0;

  /**
   * redo a simple test after the oneway to make sure we aren't "off by one" --
   * if the server treated oneway void like normal void, this next test will
   * fail since it will get the void confirmation rather than the correct
   * result. In this circumstance, the client will throw the exception:
   *
   * Because this is the last test against the server, when it completes
   * the entire suite is complete by definition (the tests run serially).
   */
  done(function() {
    test_complete = true;
  });

  //We wait up to retry_limit * retry_interval for the test suite to complete
  function TestForCompletion() {
    if(test_complete && callback) {
      callback("Server successfully tested!");
    } else {
      if (++retrys < retry_limit) {
        setTimeout(TestForCompletion, retry_interval);
      } else if (callback) {
        callback("Server test failed to complete after " +
                 (retry_limit * retry_interval / 1000) + " seconds");
      }
    }
  }

  setTimeout(TestForCompletion, retry_interval);
};
