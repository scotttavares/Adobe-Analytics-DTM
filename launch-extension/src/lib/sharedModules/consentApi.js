'use strict';

var instance = require('../instance');

/**
 * Shared module exposing the consent API to other extensions and to custom
 * code, without needing the window global:
 *
 *   var consent = turbine.getSharedModule('adobe-consent', 'consent-api');
 *   if (consent.hasConsent('analytics')) { ... }
 *   consent.gate('advertising', function () { loadPixel(); });
 *
 * `gate` is the one worth reaching for: it runs the callback now if the
 * category is already granted, and otherwise holds it until the visitor grants
 * it — so a tag never needs its own "have they consented yet" branch.
 */
module.exports = {
  hasConsent: function (category) {
    var manager = instance.get();
    return manager ? manager.hasConsent(category) === true : false;
  },

  gate: function (category, callback) {
    var manager = instance.get();
    if (!manager) {
      turbine.logger.warn('consent-api.gate called before Adobe Consent initialized');
      return function () {};
    }
    return manager.gate(category, callback);
  },

  getConsent: function () {
    var manager = instance.get();
    return manager ? manager.decision : {};
  },

  getState: function () {
    var manager = instance.get();
    return manager ? manager.state : null;
  },

  getRegion: function () {
    var manager = instance.get();
    return manager ? manager.region : '';
  },

  isPending: function () {
    var manager = instance.get();
    return manager ? manager.isPending() : true;
  },

  openPreferences: function () {
    var manager = instance.get();
    if (manager) manager.openPreferences();
  },

  on: function (event, handler) {
    var manager = instance.get();
    if (manager) return manager.on(event, handler);
    return function () {};
  },

  /** The live manager, for anything not covered above. May be null. */
  getInstance: function () {
    return instance.get();
  }
};
