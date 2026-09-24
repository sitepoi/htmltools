/* ============================================================
   Shared test-harness top bar - UniconHub html-tool system

   HOW TO USE (in any tool's test-harness.html):
     1. <link rel="stylesheet" href="<relative path>/COMMON/TestHarnessBar/harness-bar.css">
     2. <script src="<relative path>/COMMON/TestHarnessBar/harness-bar.js"></script>
        (include both BEFORE the tool's own harness script)
     3. In the harness script, instead of building your own bar:
        HarnessBar.init({
          title: 'MyTool harness',
          storageKeys: ['mytool_test_v1'],
          info: 'QA: ?role=admin&ro=1',
          buttons: [                              // custom per-tool controls
            { id: 'dump', label: 'Dump DB', onClick: function () { HarnessBar.log(JSON.stringify(db)); } }
          ],
          roles: ['admin', 'editor', 'viewer', 'none']   // optional
        });
        HarnessBar.onChange(function (state) {  // state = { role, readOnly }
          // update the mock SDK (fire userChange / readonlyChange listeners)
        });
        HarnessBar.log('anything');   // floating log panel, created automatically
        HarnessBar.getState();

   Standard controls (always rendered): Role cycle, Read-only toggle,
   Reset storage (clears storageKeys + reload). Initial role/ro come
   from the URL: ?role=...&ro=1. Everything else is a custom button.
   ============================================================ */
(function () {
  'use strict';

  var currentState = { role: 'admin', readOnly: false };
  var stateListeners = [];

  function fireChange() {
    stateListeners.forEach(function (listener) {
      try { listener({ role: currentState.role, readOnly: currentState.readOnly }); } catch (error) {}
    });
  }
  function ensureLogPanel() {
    var panel = document.getElementById('th-log');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'th-log';
      panel.id = 'th-log';
      document.body.appendChild(panel);
    }
    if (!panel.querySelector('b')) {
      var header = document.createElement('b');
      header.textContent = 'tool log';
      panel.insertBefore(header, panel.firstChild);
    }
    return panel;
  }
  function appendLogLine(text) {
    var panel = ensureLogPanel();
    var line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + '  ' + text;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  }
  function makeButton(labelText, onClickHandler) {
    var button = document.createElement('button');
    button.className = 'th-btn';
    button.type = 'button';
    button.textContent = labelText;
    if (typeof onClickHandler === 'function') button.addEventListener('click', onClickHandler);
    return button;
  }
  function init(options) {
    options = options || {};
    var query = new URLSearchParams(window.location.search);
    var roles = Array.isArray(options.roles) && options.roles.length ? options.roles : ['admin', 'editor', 'viewer', 'none'];
    var urlRole = query.get('role');
    if (urlRole && roles.indexOf(urlRole) !== -1) currentState.role = urlRole;
    else if (options.role && roles.indexOf(options.role) !== -1) currentState.role = options.role;
    else currentState.role = roles[0];
    currentState.readOnly = options.readOnly === true || query.get('ro') === '1';

    var bar = document.getElementById('th-bar');
    if (bar) {
      bar.textContent = '';
      var title = document.createElement('b');
      title.textContent = options.title || 'Test harness';
      bar.appendChild(title);

      var roleButton = makeButton('Role: ' + currentState.role, function () {
        var roleIndex = roles.indexOf(currentState.role);
        currentState.role = roles[(roleIndex + 1) % roles.length];
        roleButton.textContent = 'Role: ' + currentState.role;
        appendLogLine('role switched to ' + currentState.role);
        fireChange();
      });
      var readOnlyButton = makeButton('Read-only: ' + (currentState.readOnly ? 'yes' : 'no'), function () {
        currentState.readOnly = !currentState.readOnly;
        readOnlyButton.textContent = 'Read-only: ' + (currentState.readOnly ? 'yes' : 'no');
        appendLogLine('read-only: ' + currentState.readOnly);
        fireChange();
      });
      var resetButton = makeButton('Reset storage', function () {
        (options.storageKeys || []).forEach(function (storageKey) {
          try { localStorage.removeItem(storageKey); } catch (error) {}
        });
        window.location.reload();
      });
      bar.appendChild(roleButton);
      bar.appendChild(readOnlyButton);
      bar.appendChild(resetButton);

      (options.buttons || []).forEach(function (buttonOptions) {
        if (!buttonOptions || !buttonOptions.id || !buttonOptions.label) return;
        var customButton = makeButton(buttonOptions.label, function () {
          appendLogLine('button ' + buttonOptions.id + ' clicked');
          if (typeof buttonOptions.onClick === 'function') {
            try { buttonOptions.onClick(); } catch (error) { appendLogLine('button error: ' + error.message); }
          }
        });
        customButton.id = 'th-btn-' + buttonOptions.id;
        bar.appendChild(customButton);
      });

      if (options.info) {
        var infoSpan = document.createElement('span');
        infoSpan.className = 'th-info';
        infoSpan.textContent = options.info;
        bar.appendChild(infoSpan);
      }
    }
    ensureLogPanel();
    appendLogLine('harness ready. role=' + currentState.role + ' ro=' + currentState.readOnly);
    fireChange();
  }

  window.HarnessBar = {
    init: init,
    onChange: function (listener) { stateListeners.push(listener); },
    getState: function () { return { role: currentState.role, readOnly: currentState.readOnly }; },
    log: appendLogLine
  };
})();
