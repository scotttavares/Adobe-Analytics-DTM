'use strict';

var instance = require('../instance');

/**
 * Clears the stored decision and re-prompts. Handy on a "withdraw consent"
 * link, and for QA when you need to see the first-visit experience again.
 */
module.exports = function () {
  var manager = instance.require('Reset Consent action');
  if (manager) manager.reset();
};
