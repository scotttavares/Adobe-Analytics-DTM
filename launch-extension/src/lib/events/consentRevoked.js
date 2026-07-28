'use strict';

var instance = require('../instance');

/**
 * Fires when a specific category is withdrawn. Use it to tear down whatever the
 * matching "Consent Granted" rule set up — clear cookies, stop a pixel, drop an
 * in-memory identifier.
 */
module.exports = function (settings, trigger) {
  var category = settings && settings.category;
  if (!category) {
    turbine.logger.error('Consent Revoked event is missing a category');
    return;
  }

  document.addEventListener('adobeConsent:revoked', function (event) {
    var revoked = event.detail || [];
    if (revoked.indexOf(category) === -1) return;

    var manager = instance.get();
    trigger({
      category: category,
      granted: false,
      source: 'change',
      consent: manager ? manager.decision : {}
    });
  });
};
