'use strict';

var instance = require('../instance');

/**
 * The region code the consent model was chosen from (`EU`, `US-CA`, …). Useful
 * as a CJA dimension to segment consent rates by jurisdiction.
 */
module.exports = function () {
  var manager = instance.require('Consent Region data element');
  return manager ? manager.region : '';
};
