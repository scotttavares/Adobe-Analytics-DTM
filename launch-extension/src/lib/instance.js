'use strict';

/**
 * Holds the running ConsentManager for the other library modules.
 *
 * Turbine gives no ordering guarantee between `main` and the modules a rule
 * pulls in, and it caches modules per path, so this falls back to the window
 * global that main.js also publishes. One of the two is always populated by the
 * time a rule condition or data element actually executes.
 */

var instance = null;

module.exports = {
  set: function (value) {
    instance = value;
  },

  get: function () {
    if (instance) return instance;
    if (typeof window !== 'undefined' && window.AdobeConsent) return window.AdobeConsent;
    return null;
  },

  /** Resolves the manager or logs a single actionable warning. */
  require: function (context) {
    var manager = module.exports.get();
    if (!manager) {
      turbine.logger.warn(
        'Adobe Consent is not initialized yet' +
          (context ? ' (' + context + ')' : '') +
          '. Check that the extension configuration has been saved and the ' +
          'library republished.'
      );
    }
    return manager;
  }
};
