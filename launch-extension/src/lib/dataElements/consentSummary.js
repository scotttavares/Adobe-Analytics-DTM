'use strict';

var instance = require('../instance');

/**
 * A compact, low-cardinality summary of the whole decision, meant for a single
 * Analytics prop or a CJA dimension — for example
 * `essential+analytics|save_choices|EU`.
 *
 * Reporting on this one dimension answers "what does our consent rate look
 * like, and how is it trending" without burning four separate variables.
 */
module.exports = function () {
  var manager = instance.require('Consent Summary data element');
  if (!manager) return 'unknown';

  var decision = manager.decision;
  var granted = Object.keys(decision)
    .filter(function (id) {
      return decision[id];
    })
    .sort();

  var state = manager.state;
  var method = (state && state.method) || (manager.isPending() ? 'pending' : 'unknown');

  return (granted.length ? granted.join('+') : 'none') + '|' + method + '|' + manager.region;
};
