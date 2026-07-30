'use strict';

var instance = require('../instance');

/**
 * Fires when a specific category becomes granted.
 *
 * Also fires once on page load if the category is *already* granted from a
 * previous visit. Without that, the obvious rule — "load this tag when the
 * visitor has consented to analytics" — would silently never run for returning
 * visitors, which is the single most common consent-gating bug.
 */
module.exports = function (settings, trigger) {
  var category = settings && settings.category;
  if (!category) {
    turbine.logger.error('Consent Granted event is missing a category');
    return;
  }

  var fired = false;

  var fire = function (source) {
    if (fired) return;
    fired = true;
    var manager = instance.get();
    trigger({
      category: category,
      granted: true,
      source: source,
      consent: manager ? manager.decision : {}
    });
  };

  document.addEventListener('clearConsent:granted', function (event) {
    var granted = event.detail || [];
    if (granted.indexOf(category) !== -1) fire('change');
  });

  setTimeout(function () {
    var manager = instance.get();
    if (manager && manager.hasConsent(category)) fire('page-load');
  }, 0);
};
