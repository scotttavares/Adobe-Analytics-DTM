'use strict';

var instance = require('../instance');

/** Re-shows the first-layer consent notice. */
module.exports = function () {
  var manager = instance.require('Show Consent Banner action');
  if (manager) manager.showBanner();
};
