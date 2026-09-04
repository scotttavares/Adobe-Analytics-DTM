'use strict';

var instance = require('../instance');

/**
 * The consent state of one category, in whichever notation the destination
 * needs: a real boolean for custom code, `y`/`n` for the Adobe consent
 * standard, `in`/`out` for the 1.0 standard, or `1`/`0` for an Analytics
 * prop/eVar.
 */
module.exports = function (settings) {
  var manager = instance.require('Consent Status data element');
  var category = settings && settings.category;
  var granted = manager && category ? manager.hasConsent(category) === true : false;

  switch ((settings && settings.format) || 'boolean') {
    case 'yn':
      return granted ? 'y' : 'n';
    case 'inout':
      return granted ? 'in' : 'out';
    case '10':
      return granted ? '1' : '0';
    default:
      return granted;
  }
};
