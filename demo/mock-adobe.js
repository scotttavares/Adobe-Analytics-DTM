/**
 * Stand-ins for the Adobe libraries.
 *
 * Each one has the same call signature as the real thing and records what it
 * receives, so the demo can show the consent manager driving Adobe without
 * needing a datastream, an org id, or a network connection.
 */
(function () {
  'use strict';

  var listeners = [];
  window.__demoCalls = [];

  window.__demoLog = function (api, message, payload) {
    var entry = { api: api, message: message, payload: payload, at: Date.now() };
    window.__demoCalls.push(entry);
    listeners.forEach(function (fn) {
      fn(entry);
    });
  };

  window.__demoOnCall = function (fn) {
    listeners.push(fn);
  };

  // --- AEP Web SDK ---------------------------------------------------------
  // Mirrors the real base code, including the __alloyNS registration that the
  // consent manager uses to discover instance names.
  (function (n, o) {
    o.forEach(function (name) {
      (n.__alloyNS = n.__alloyNS || []).push(name);
      n[name] = function (command, options) {
        if (command === 'setConsent') {
          var value = options && options.consent && options.consent[0]
            ? options.consent[0].value
            : {};
          window.__demoLog(
            'alloy',
            'setConsent — collect:' + ((value.collect && value.collect.val) || '?') +
              ' share:' + ((value.share && value.share.val) || '?') +
              ' personalize:' +
              ((value.personalize && value.personalize.content && value.personalize.content.val) || '?'),
            options
          );
        } else {
          window.__demoLog('alloy', command, options);
        }
        return Promise.resolve();
      };
    });
  })(window, ['alloy']);

  // --- ECID Opt-In service -------------------------------------------------
  window.adobe = window.adobe || {};
  window.adobe.OptInCategories = {
    AAM: 'aam',
    ANALYTICS: 'aa',
    ECID: 'ecid',
    TARGET: 'target'
  };

  var permissions = { aam: false, aa: false, ecid: false, target: false };
  var staged = {};

  window.adobe.optIn = {
    permissions: permissions,
    status: 'pending',
    approve: function (categories, shouldWaitForComplete) {
      categories.forEach(function (category) {
        staged[category] = true;
      });
      if (!shouldWaitForComplete) this.complete();
    },
    deny: function (categories, shouldWaitForComplete) {
      categories.forEach(function (category) {
        staged[category] = false;
      });
      if (!shouldWaitForComplete) this.complete();
    },
    complete: function () {
      Object.keys(staged).forEach(function (category) {
        permissions[category] = staged[category];
      });
      staged = {};
      this.status = 'complete';
      var approved = Object.keys(permissions).filter(function (k) {
        return permissions[k];
      });
      window.__demoLog(
        'adobe.optIn',
        'complete — approved: ' + (approved.length ? approved.join(', ') : 'none'),
        JSON.parse(JSON.stringify(permissions))
      );
    },
    isApproved: function (categories) {
      return (categories || []).every(function (category) {
        return permissions[category] === true;
      });
    }
  };

  // --- AppMeasurement ------------------------------------------------------
  window.s = {
    account: 'demoreportsuite',
    abort: false,
    optOut: false,
    t: function () {
      if (this.abort || this.optOut) {
        window.__demoLog('AppMeasurement', 's.t() suppressed — analytics consent denied');
        return;
      }
      window.__demoLog('AppMeasurement', 's.t() page view sent');
    }
  };

  // Report the gate flipping, without stopping the consent manager writing it.
  var abortValue = false;
  Object.defineProperty(window.s, 'abort', {
    get: function () {
      return abortValue;
    },
    set: function (value) {
      if (value !== abortValue) {
        abortValue = value;
        window.__demoLog(
          'AppMeasurement',
          value ? 's.abort = true — beacons suppressed' : 's.abort = false — tracking allowed'
        );
      }
    }
  });

  // --- Adobe Client Data Layer --------------------------------------------
  window.adobeDataLayer = window.adobeDataLayer || [];
  var nativePush = window.adobeDataLayer.push.bind(window.adobeDataLayer);
  window.adobeDataLayer.push = function (item) {
    if (item && item.event) {
      window.__demoLog('adobeDataLayer', 'push "' + item.event + '"', item);
    }
    return nativePush(item);
  };

  // --- Launch _satellite ---------------------------------------------------
  window._satellite = {
    track: function (identifier, detail) {
      window.__demoLog('_satellite', 'track("' + identifier + '")', detail);
    },
    logger: {
      log: function () {}
    }
  };
})();
