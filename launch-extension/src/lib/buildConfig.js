'use strict';

/**
 * Translates the flat key/value settings the extension view produces into the
 * nested ConsentConfig the library expects. Kept separate from main.js so it
 * can be reasoned about (and unit-tested) on its own.
 */

function splitList(value) {
  if (!value) return null;
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

function assignIf(target, key, value) {
  if (value !== undefined && value !== null && value !== '') target[key] = value;
}

module.exports = function buildConfig(settings) {
  settings = settings || {};

  var config = {
    autoInit: false
  };

  assignIf(config, 'policyVersion', settings.policyVersion);
  assignIf(config, 'model', settings.model);
  assignIf(config, 'reconsentDays', settings.reconsentDays);

  if (settings.honorGpc !== undefined) config.honorGpc = !!settings.honorGpc;
  if (settings.honorDnt !== undefined) config.honorDnt = !!settings.honorDnt;
  if (settings.autoBlock !== undefined) config.autoBlock = !!settings.autoBlock;
  if (settings.debug !== undefined) config.debug = !!settings.debug;

  if (Array.isArray(settings.categories) && settings.categories.length) {
    config.categories = settings.categories.map(function (category) {
      return {
        id: category.id,
        label: category.label,
        summary: category.summary,
        description: category.description,
        required: !!category.required
      };
    });
  }

  // --- geo ---------------------------------------------------------------
  var geo = {};
  assignIf(geo, 'region', settings.region);
  assignIf(geo, 'endpoint', settings.geoEndpoint);
  if (Object.keys(geo).length) config.geo = geo;

  // --- storage -----------------------------------------------------------
  var storage = {};
  assignIf(storage, 'cookieName', settings.cookieName);
  assignIf(storage, 'cookieDomain', settings.cookieDomain);
  assignIf(storage, 'expiryDays', settings.expiryDays);
  if (Object.keys(storage).length) config.storage = storage;

  // --- ui ----------------------------------------------------------------
  var ui = {};
  assignIf(ui, 'layout', settings.layout);
  assignIf(ui, 'position', settings.position);
  assignIf(ui, 'badgePosition', settings.badgePosition);
  if (settings.blocking !== undefined) ui.blocking = !!settings.blocking;
  if (settings.showBadge !== undefined) ui.showBadge = !!settings.showBadge;
  if (settings.headless !== undefined) ui.headless = !!settings.headless;

  var text = {};
  assignIf(text, 'title', settings.title);
  assignIf(text, 'body', settings.body);
  assignIf(text, 'acceptAll', settings.acceptAll);
  assignIf(text, 'rejectAll', settings.rejectAll);
  assignIf(text, 'save', settings.save);
  assignIf(text, 'preferences', settings.preferences);
  assignIf(text, 'privacyPolicy', settings.privacyPolicy);
  assignIf(text, 'privacyPolicyUrl', settings.privacyPolicyUrl);
  if (Object.keys(text).length) ui.text = text;

  var theme = {};
  assignIf(theme, 'surface', settings.surface);
  assignIf(theme, 'text', settings.text);
  assignIf(theme, 'accent', settings.accent);
  assignIf(theme, 'accentText', settings.accentText);
  assignIf(theme, 'radius', settings.radius);
  if (Object.keys(theme).length) ui.theme = theme;

  if (Object.keys(ui).length) config.ui = ui;

  // --- adobe -------------------------------------------------------------
  var adobe = {};

  var mapping = {};
  var mappingKeys = {
    mappingCollect: 'collect',
    mappingShare: 'share',
    mappingPersonalize: 'personalize',
    mappingAdId: 'adId',
    mappingAnalytics: 'analytics',
    mappingTarget: 'target',
    mappingAudienceManager: 'audienceManager'
  };
  Object.keys(mappingKeys).forEach(function (settingKey) {
    var list = splitList(settings[settingKey]);
    if (list && list.length) mapping[mappingKeys[settingKey]] = list;
  });
  if (Object.keys(mapping).length) adobe.mapping = mapping;

  var webSdk = {};
  if (settings.webSdkEnabled !== undefined) webSdk.enabled = !!settings.webSdkEnabled;
  assignIf(webSdk, 'standardVersion', settings.webSdkStandardVersion);
  var instances = splitList(settings.webSdkInstanceNames);
  if (instances && instances.length) webSdk.instanceNames = instances;
  if (Object.keys(webSdk).length) adobe.webSdk = webSdk;

  if (settings.optInEnabled !== undefined) adobe.optIn = { enabled: !!settings.optInEnabled };

  var analytics = {};
  if (settings.analyticsEnabled !== undefined) analytics.enabled = !!settings.analyticsEnabled;
  assignIf(analytics, 'instanceGlobal', settings.analyticsInstanceGlobal);
  if (Object.keys(analytics).length) adobe.analytics = analytics;

  var dataLayer = {};
  if (settings.dataLayerEnabled !== undefined) dataLayer.enabled = !!settings.dataLayerEnabled;
  assignIf(dataLayer, 'name', settings.dataLayerName);
  if (Object.keys(dataLayer).length) adobe.dataLayer = dataLayer;

  var launch = {};
  if (settings.launchDirectCallEnabled !== undefined) {
    launch.enabled = !!settings.launchDirectCallEnabled;
  }
  assignIf(launch, 'directCallId', settings.directCallId);
  if (Object.keys(launch).length) adobe.launch = launch;

  if (Object.keys(adobe).length) config.adobe = adobe;

  // --- receipts ----------------------------------------------------------
  if (settings.receiptEndpoint) {
    config.receipt = { enabled: true, endpoint: settings.receiptEndpoint, historySize: 10 };
  }

  return config;
};
