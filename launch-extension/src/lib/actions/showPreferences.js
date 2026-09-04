'use strict';

var instance = require('../instance');

/** Opens the preference center. Wire it to a footer "Privacy choices" link. */
module.exports = function () {
  var manager = instance.require('Show Preference Center action');
  if (manager) manager.openPreferences();
};
