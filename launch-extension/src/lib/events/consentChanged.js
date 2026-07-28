'use strict';

var instance = require('../instance');

/**
 * Fires whenever the visitor's consent changes.
 *
 * Listens on the document rather than on the manager instance: Turbine gives no
 * ordering guarantee between the extension's main module and rule
 * registration, so subscribing to a DOM event that the engine always dispatches
 * removes the race entirely.
 *
 * Rule authors get `%event.consent.analytics%`, `%event.granted%`,
 * `%event.method%`, and so on.
 */
module.exports = function (settings, trigger) {
  var fired = false;

  var toDetail = function (payload) {
    var state = payload && payload.state ? payload.state : null;
    return {
      consent: (state && state.categories) || {},
      granted: (payload && payload.granted) || [],
      revoked: (payload && payload.revoked) || [],
      method: state && state.method,
      region: state && state.region,
      policyVersion: state && state.policyVersion,
      receiptId: state && state.id
    };
  };

  document.addEventListener('adobeConsent:change', function (event) {
    fired = true;
    trigger(toDetail(event.detail));
  });

  if (settings && settings.includeInitial) {
    // `ready` may already have fired if main.js ran first, so check the live
    // state on the next tick instead of relying on catching the event.
    document.addEventListener('adobeConsent:ready', function (event) {
      if (fired) return;
      fired = true;
      trigger(toDetail({ state: event.detail, granted: [], revoked: [] }));
    });

    setTimeout(function () {
      if (fired) return;
      var manager = instance.get();
      if (!manager) return;
      fired = true;
      trigger(toDetail({ state: manager.state, granted: [], revoked: [] }));
    }, 0);
  }
};
