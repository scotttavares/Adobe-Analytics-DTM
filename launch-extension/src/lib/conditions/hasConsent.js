'use strict';

var instance = require('../instance');

/**
 * Passes when the visitor has granted the chosen category.
 *
 * Fails closed: if the manager is somehow unavailable, the answer is "no
 * consent" rather than an accidental green light.
 */
module.exports = function (settings) {
  var manager = instance.require('Has Consent condition');
  if (!manager) return false;

  var category = settings && settings.category;
  if (!category) {
    turbine.logger.error('Has Consent condition is missing a category');
    return false;
  }

  return manager.hasConsent(category) === true;
};
