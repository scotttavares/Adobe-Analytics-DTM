'use strict';

/**
 * Runs when the Tags library loads.
 *
 * The CMP itself is `require`d from a vendored CommonJS bundle, so it is
 * inlined into the Launch runtime library. There is no second script tag and no
 * additional round trip before the banner can render — the usual three-request
 * stub-then-config-then-SDK chain of a hosted CMP simply does not exist here.
 */

var consent = require('./vendor/adobe-consent');
var instance = require('./instance');
var buildConfig = require('./buildConfig');

var settings = turbine.getExtensionSettings() || {};
var config = buildConfig(settings);

config.debug = config.debug || turbine.debugEnabled;

try {
  var manager = consent.init(config);

  instance.set(manager);
  // Published globally so site code and other extensions can reach it without
  // going through turbine.getSharedModule.
  if (typeof window !== 'undefined') window.AdobeConsent = manager;

  turbine.logger.info(
    'Adobe Consent initialized (region "' +
      manager.region +
      '", model "' +
      manager.engine.model +
      '", environment "' +
      turbine.environment.stage +
      '")'
  );
} catch (e) {
  turbine.logger.error('Adobe Consent failed to initialize: ' + (e && e.message));
}
