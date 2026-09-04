'use strict';

var instance = require('../instance');

/**
 * The consent object in Adobe consent standard 2.0 shape:
 *
 *   { collect: {val:'y'}, share: {val:'n'},
 *     personalize: {content:{val:'y'}}, adID: {val:'n'} }
 *
 * The extension already calls `setConsent` for you, so this exists for the
 * cases where you also want consent travelling *with* an event — map it onto
 * `xdm.consents` in a Web SDK Send Event action, or forward it to a
 * non-Adobe destination that needs the same answer.
 */
module.exports = function () {
  var manager = instance.require('Consent XDM data element');
  if (!manager || !manager.adobe || !manager.adobe.webSdk) return {};

  var payload = manager.adobe.webSdk.buildPayload(manager.decision);
  var entry = payload && payload[0];
  return entry && entry.value ? entry.value : {};
};
