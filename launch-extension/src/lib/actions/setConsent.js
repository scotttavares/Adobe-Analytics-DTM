'use strict';

var instance = require('../instance');

function splitList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(function (part) {
      return part.trim();
    })
    .filter(function (part) {
      return part.length > 0;
    });
}

/**
 * Sets consent programmatically.
 *
 * This is the bridge for sites that already collect consent somewhere else — a
 * native app webview, a server-rendered preference page, or an existing CMP
 * being migrated away from. Point a rule at whatever signal you already have
 * and hand the answer to this action.
 */
module.exports = function (settings) {
  var manager = instance.require('Set Consent action');
  if (!manager) return;

  var mode = (settings && settings.mode) || 'update';

  if (mode === 'acceptAll') {
    manager.acceptAll();
    return;
  }
  if (mode === 'rejectAll') {
    manager.rejectAll();
    return;
  }

  var patch = {};
  splitList(settings && settings.grant).forEach(function (category) {
    patch[category] = true;
  });
  splitList(settings && settings.deny).forEach(function (category) {
    patch[category] = false;
  });

  if (!Object.keys(patch).length) {
    turbine.logger.warn('Set Consent action ran with nothing to grant or deny');
    return;
  }

  manager.update(patch);
};
