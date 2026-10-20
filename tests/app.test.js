const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.value = '';
    this.textContent = '';
  }

  get id() {
    return this._id || '';
  }

  set id(value) {
    if (this._id) {
      delete this.ownerDocument.nodesById[this._id];
    }

    this._id = value ? String(value) : '';

    if (this._id) {
      this.ownerDocument.nodesById[this._id] = this;
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches.length ? matches[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];

    function walk(node) {
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];

        if (matchesSelector(child, selector)) {
          results.push(child);
        }

        walk(child);
      }
    }

    walk(this);
    return results;
  }
}

function matchesSelector(element, selector) {
  if (!selector) {
    return false;
  }

  if (selector.charAt(0) === '#') {
    return element.id === selector.slice(1);
  }

  const classAttrMatch = selector.match(/^\.([^\[]+)\[data-([^=]+)="([^"]+)"\]$/);
  if (classAttrMatch) {
    return element.className.split(/\s+/).includes(classAttrMatch[1]) &&
      String(element.dataset[classAttrMatch[2]]) === classAttrMatch[3];
  }

  return false;
}

class FakeDocument {
  constructor() {
    this.nodesById = {};
    this.body = new FakeElement('body', this);
    this.listeners = {};
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.nodesById[id] || null;
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  addEventListener(eventName, handler) {
    this.listeners[eventName] = handler;
  }
}

function loadApp() {
  const document = new FakeDocument();
  const window = { document: document };
  const toastCalls = [];
  let savedParticipant = null;
  let savedBracket = null;
  let syncCalls = 0;

  const context = {
    window: window,
    document: document,
    console: console,
    BilposStorage: {
      loadParticipants: function () {
        return savedParticipant ? [savedParticipant] : [];
      },
      saveParticipant: function (participant) {
        savedParticipant = participant;
      },
      loadBracket: function () {
        return null;
      },
      saveBracket: function (bracket) {
        savedBracket = bracket;
      }
    },
    BilposTournament: {
      syncParticipantInBracket: function (bracket, participantId, name, hc) {
        syncCalls += 1;
        return {
          source: bracket,
          participantId: participantId,
          name: name,
          hc: hc
        };
      }
    },
    BilposUI: {
      showToast: function (message, type) {
        toastCalls.push({ message: message, type: type });
      }
    }
  };

  window.BilposStorage = context.BilposStorage;
  window.BilposTournament = context.BilposTournament;
  window.BilposUI = context.BilposUI;

  const appPath = path.join(process.cwd(), 'assets', 'js', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    BilposApp: context.window.BilposApp,
    document: document,
    toastCalls: toastCalls,
    getSavedParticipant: function () {
      return savedParticipant;
    },
    getSavedBracket: function () {
      return savedBracket;
    },
    getSyncCalls: function () {
      return syncCalls;
    }
  };
}

function appendField(document, className, row, value) {
  const element = document.createElement('input');
  element.className = className;
  element.dataset.row = String(row);
  element.value = value;
  document.body.appendChild(element);
  return element;
}

function appendRowFixture(document, row, overrides) {
  const config = overrides || {};
  const rowElement = document.createElement('tr');
  rowElement.id = 'row-' + row;
  rowElement.dataset.currentStatus = config.status || '';
  document.body.appendChild(rowElement);

  appendField(document, 'phone-input', row, config.phone || '');
  appendField(document, 'name-input', row, config.name || '');

  const select = appendField(document, 'hc-select', row, config.hcValue || '');
  select.value = config.hcValue || '';

  appendField(document, 'hc-custom-input', row, config.hcCustom || '');

  const badge = document.createElement('span');
  badge.className = 'drawing-badge';
  badge.dataset.row = String(row);
  badge.textContent = config.drawingNumber != null ? String(config.drawingNumber) : '';
  document.body.appendChild(badge);
}

test('saveParticipantRow renders bracket even when no bracket exists yet', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;
  let renderBracketCalls = 0;
  let renderStatsCalls = 0;

  appendRowFixture(loaded.document, 1, {
    phone: '08123',
    name: 'Alpha',
    hcValue: 'HC 3B',
    status: 'cash',
    drawingNumber: 9
  });

  app.bracket = null;
  app.renderBracket = function () {
    renderBracketCalls += 1;
  };
  app.renderStats = function () {
    renderStatsCalls += 1;
  };

  app.saveParticipantRow(1);

  assert.equal(renderBracketCalls, 1);
  assert.equal(renderStatsCalls, 1);
  assert.equal(loaded.getSyncCalls(), 0);
  assert.deepEqual(loaded.toastCalls, []);
  assert.equal(loaded.getSavedParticipant().name, 'Alpha');
});

test('saveParticipantRow does not double-render when syncing an existing bracket', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;
  let renderBracketCalls = 0;
  let renderStatsCalls = 0;
  const originalBracket = { rounds: [] };

  appendRowFixture(loaded.document, 2, {
    phone: '08234',
    name: 'Bravo',
    hcValue: 'HC 3N',
    status: 'tf',
    drawingNumber: 7
  });

  app.bracket = originalBracket;
  app.renderBracket = function () {
    renderBracketCalls += 1;
  };
  app.renderStats = function () {
    renderStatsCalls += 1;
  };

  app.saveParticipantRow(2);

  assert.equal(renderBracketCalls, 1);
  assert.equal(renderStatsCalls, 1);
  assert.equal(loaded.getSyncCalls(), 1);
  assert.equal(loaded.getSavedBracket().source, originalBracket);
  assert.equal(app.bracket.participantId, 'row-2');
});

test('renderParticipantTable displays a participant drawing-number input after HC', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;
  const tbody = loaded.document.createElement('tbody');
  tbody.id = 'participant-tbody';
  loaded.document.body.appendChild(tbody);
  app.tournament = { size: 2 };
  app.participants = [{
    id: 'row-2',
    slot: 1,
    drawingNumber: 2,
    name: 'Alpha',
    hc: 'HC 3B',
    status: ''
  }];

  app.renderParticipantTable();

  const hcPosition = tbody.innerHTML.indexOf('hc-select');
  const bracketPosition = tbody.innerHTML.indexOf('bracket-input');
  const deletePosition = tbody.innerHTML.indexOf('btn-delete-row');
  assert.ok(hcPosition >= 0);
  assert.ok(bracketPosition > hcPosition);
  assert.ok(deletePosition > bracketPosition);
  assert.match(tbody.innerHTML, /class="table-input bracket-input"[^>]*value="2"/);
  assert.match(tbody.innerHTML, /data-participant-id="row-2"/);
});

test('saveParticipantRow preserves an assigned drawing number when participant details change', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;
  app.participants = [{
    id: 'row-1',
    slot: 1,
    drawingNumber: 4,
    name: 'Before',
    hc: 'HC 3B',
    status: 'cash'
  }];
  appendRowFixture(loaded.document, 1, {
    name: 'After',
    hcValue: 'HC 3N',
    status: 'cash'
  });
  app.renderStats = function () {};

  app.saveParticipantRow(1);

  assert.equal(loaded.getSavedParticipant().drawingNumber, 4);
});
