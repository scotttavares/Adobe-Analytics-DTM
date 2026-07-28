/**
 * Demo glue: renders the live consent state and the log of Adobe calls.
 */
(function () {
  'use strict';

  var consent = window.AdobeConsent && window.AdobeConsent.instance;
  if (!consent) {
    // eslint-disable-next-line no-console
    console.error('adobe-consent did not initialize — run `npm run build` first.');
    return;
  }

  var logEl = document.getElementById('log');
  var gridEl = document.getElementById('stateGrid');
  var regionEl = document.getElementById('regionLine');

  function timestamp(at) {
    var d = new Date(at);
    return (
      ('0' + d.getHours()).slice(-2) +
      ':' + ('0' + d.getMinutes()).slice(-2) +
      ':' + ('0' + d.getSeconds()).slice(-2)
    );
  }

  function appendLog(entry) {
    var empty = logEl.querySelector('.empty');
    if (empty) empty.remove();

    var row = document.createElement('div');

    var time = document.createElement('span');
    time.className = 'muted';
    time.textContent = timestamp(entry.at) + '  ';

    var api = document.createElement('span');
    api.className = 'api';
    api.textContent = entry.api;

    row.appendChild(time);
    row.appendChild(api);
    row.appendChild(document.createTextNode('  ' + entry.message));

    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  }

  window.__demoCalls.forEach(appendLog);
  window.__demoOnCall(appendLog);

  function renderState() {
    var decision = consent.decision;
    gridEl.textContent = '';

    consent.engine.getCategories().forEach(function (category) {
      var granted = decision[category.id] === true;
      var chip = document.createElement('div');
      chip.className = 'chip ' + (granted ? 'on' : 'off');

      var name = document.createElement('span');
      name.textContent = category.label;

      var val = document.createElement('span');
      val.className = 'val';
      val.textContent = granted ? 'granted' : 'denied';

      chip.appendChild(name);
      chip.appendChild(val);
      gridEl.appendChild(chip);
    });

    var state = consent.state;
    regionEl.textContent =
      'Region ' + consent.region +
      ' · model ' + consent.engine.model +
      ' · ' + (consent.isPending()
        ? 'awaiting a decision'
        : 'decided via "' + (state && state.method) + '"');
  }

  renderState();
  consent.on('change', renderState);
  consent.on('ready', renderState);

  // A gated callback: queued now, run the instant analytics is granted.
  consent.gate('analytics', function () {
    window.__demoLog('gate', 'analytics gate released — running queued analytics setup');
    if (window.s) window.s.t();
  });

  consent.gate('advertising', function () {
    window.__demoLog('gate', 'advertising gate released — remarketing pixel would load here');
  });

  document.getElementById('openPrefs').addEventListener('click', function () {
    consent.openPreferences();
  });
  document.getElementById('footerPrefs').addEventListener('click', function () {
    consent.openPreferences();
  });
  document.getElementById('acceptAll').addEventListener('click', function () {
    consent.acceptAll();
  });
  document.getElementById('rejectAll').addEventListener('click', function () {
    consent.rejectAll();
  });
  document.getElementById('resetConsent').addEventListener('click', function () {
    consent.reset();
  });
  document.getElementById('clearLog').addEventListener('click', function () {
    logEl.textContent = '';
    var empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Cleared.';
    logEl.appendChild(empty);
  });
})();
