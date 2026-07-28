'use strict';

var instance = require('../instance');

/**
 * Re-scans the page for blocked tags. Call this after a single-page-app route
 * change that injected new markup, so newly added blocked scripts are
 * evaluated against the current consent state.
 */
module.exports = function () {
  var manager = instance.require('Re-scan Blocked Tags action');
  if (manager) manager.rescan();
};
