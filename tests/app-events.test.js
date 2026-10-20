const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.items = [];
  }

  _sync() {
    this.element._className = this.items.join(' ');
  }

  setFromString(value) {
    this.items = String(value || '')
      .split(/\s+/)
      .filter(Boolean);
    this._sync();
  }

  contains(token) {
    return this.items.includes(token);
  }

  add(token) {
    if (!this.items.includes(token)) {
      this.items.push(token);
      this._sync();
    }
  }

  remove(token) {
    const idx = this.items.indexOf(token);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      this._sync();
    }
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.textContent = '';
    this.value = '';
    this.listeners = {};
    this._className = '';
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.setFromString(value);
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

  addEventListener(eventName, handler) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }

    this.listeners[eventName].push(handler);
  }

  dispatchEvent(eventName, eventObject) {
    const handlers = this.listeners[eventName] || [];
    handlers.forEach((handler) => handler(eventObject));
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

function toDatasetKey(name) {
  return String(name || '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function matchesSelector(element, selector) {
  if (!selector) {
    return false;
  }

  if (selector.charAt(0) === '#') {
    return element.id === selector.slice(1);
  }

  if (selector.charAt(0) === '.' && selector.indexOf('[') === -1) {
    return element.classList.contains(selector.slice(1));
  }

  const classAttrMatch = selector.match(/^\.([^\[]+)\[data-([^=]+)="([^"]+)"\]$/);
  if (classAttrMatch) {
    return (
      element.classList.contains(classAttrMatch[1]) &&
      String(element.dataset[toDatasetKey(classAttrMatch[2])]) === classAttrMatch[3]
    );
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

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(eventName, handler) {
    this.listeners[eventName] = handler;
  }
}

function appendElement(document, tagName, config) {
  const element = document.createElement(tagName);
  const options = config || {};

  if (options.id) {
    element.id = options.id;
  }

  if (options.className) {
    element.className = options.className;
  }

  if (options.value != null) {
    element.value = String(options.value);
  }

  if (options.textContent != null) {
    element.textContent = String(options.textContent);
  }

  if (options.dataset) {
    Object.keys(options.dataset).forEach((key) => {
      element.dataset[key] = String(options.dataset[key]);
    });
  }

  document.body.appendChild(element);
  return element;
}

function loadApp(options) {
  const document = new FakeDocument();
  const window = { document: document };
  const config = options || {};
  const toastCalls = [];
  const savedParticipantsCalls = [];
  const savedBracketCalls = [];
  const transferCalls = [];
  const deletedParticipantIds = [];
  const dispatchedEvents = [];
  let participants = config.participants ? config.participants.slice() : [];
  let tournament = config.tournament || { size: 2, venue: '', status: '' };

  window.addEventListener = function(eventName, handler) {};
  window.dispatchEvent = function(event) {
    dispatchedEvents.push(event && event.type ? event.type : String(event));
  };

  const context = {
    window: window,
    document: document,
    console: console,
    CustomEvent: function(type) { return { type: type }; },
    BilposStorage: {
      loadTournament: function () {
        return tournament;
      },
      loadParticipants: function () {
        return participants;
      },
      loadBracket: function () {
        return config.bracket || null;
      },
      loadSettings: function () {
        return { zoom: 100 };
      },
      saveTournament: function(data) {},
      replaceTournamentTransfer: function (nextTournament, nextParticipants, bracketData) {
        tournament = nextTournament;
        participants = nextParticipants;
        config.bracket = bracketData;
        transferCalls.push({
          tournament: nextTournament,
          participants: nextParticipants,
          bracket: bracketData
        });
        return true;
      },
      saveParticipants: function (nextParticipants) {
        participants = nextParticipants;
        savedParticipantsCalls.push(nextParticipants);
      },
      saveBracket: function (bracket) {
        config.bracket = bracket;
        savedBracketCalls.push(bracket);
      },
      deleteParticipant: function (id) {
        deletedParticipantIds.push(id);
        const before = participants.length;
        participants = participants.filter((participant) => participant && participant.id !== id);
        return participants.length < before;
      }
    },
    confirm: config.confirm || function () { return true; },
    BilposExcelTransfer: config.excelTransfer || {
      validateDrawingNumber: function (value, size, existingParticipants, excludeId) {
        if (value == null || String(value).trim() === '') return null;
        if (!/^\d+$/.test(String(value).trim())) throw new Error('Bracket slot harus bilangan bulat');
        const slot = Number(value);
        if (slot < 1 || slot > size) throw new Error('Bracket slot di luar batas');
        if (existingParticipants.some((participant) => participant.id !== excludeId && Number(participant.drawingNumber) === slot)) {
          throw new Error('Bracket slot tidak boleh duplikat');
        }
        return slot;
      }
    },
    BilposDrawing: {
      drawSlot: config.drawSlot || function () {
        return null;
      }
    },
    BilposTournament: {
      advanceWinner: config.advanceWinner || function (bracket, roundIdx, matchIdx, winner) {
        return {
          bracket: bracket,
          roundIdx: roundIdx,
          matchIdx: matchIdx,
          winner: winner
        };
      },
      generateBracket: config.generateBracket || function (size, currentParticipants) {
        return {
          size: size,
          rounds: [[{
            id: 'r0m0',
            p1: currentParticipants[0] || null,
            p2: null,
            score1: '',
            score2: '',
            winner: null,
            status: 'pending'
          }]]
        };
      }
    },
    BilposUI: {
      showToast: function (message, type) {
        toastCalls.push({ message: message, type: type });
      },
      updateHeader: function() {}
    }
  };
  context.XLSX = config.xlsx;
  context.FileReader = config.FileReader;

  window.BilposStorage = context.BilposStorage;
  window.BilposDrawing = context.BilposDrawing;
  window.BilposTournament = context.BilposTournament;
  window.BilposExcelTransfer = context.BilposExcelTransfer;
  window.BilposUI = context.BilposUI;

  const appPath = path.join(process.cwd(), 'assets', 'js', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    BilposApp: context.window.BilposApp,
    document: document,
    window: window,
    toastCalls: toastCalls,
    dispatchedEvents: dispatchedEvents,
    getSavedParticipantsCalls: function () {
      return savedParticipantsCalls;
    },
    getSavedBracketCalls: function () {
      return savedBracketCalls;
    },
    getParticipants: function () {
      return participants;
    },
    getTransferCalls: function () {
      return transferCalls;
    },
    getDeletedParticipantIds: function () {
      return deletedParticipantIds;
    },
    getTournament: function () {
      return tournament;
    }
  };
}

test('deleting the first displayed imported participant uses its stable id', () => {
  const loaded = loadApp({
    participants: [{ id: 'row-2', name: 'Intan', drawingNumber: 2 }]
  });
  const tbody = appendElement(loaded.document, 'tbody', { id: 'participant-tbody' });
  const deleteButton = appendElement(loaded.document, 'button', {
    className: 'btn-delete-row',
    dataset: { row: 1, participantId: 'row-2' }
  });
  loaded.BilposApp.tournament = { size: 2 };
  loaded.BilposApp.participants = loaded.getParticipants();
  loaded.BilposApp.wireEvents();

  tbody.dispatchEvent('click', {
    target: {
      closest: function (selector) {
        return selector === '.btn-delete-row' ? deleteButton : null;
      }
    }
  });

  assert.deepEqual(Array.from(loaded.getDeletedParticipantIds()), ['row-2']);
  assert.deepEqual(Array.from(loaded.getParticipants()), []);
});

test('draw all persists assigned drawing numbers to storage', () => {
  const participants = [
    { id: 'row-1', phone: '08111', drawingNumber: null },
    { id: 'row-2', phone: '08222', drawingNumber: null }
  ];
  const loaded = loadApp({
    participants: participants,
    drawSlot: function (size, currentParticipants, phone) {
      return phone === '08111' ? 1 : 2;
    }
  });
  const app = loaded.BilposApp;
  const drawAllButton = appendElement(loaded.document, 'button', { id: 'btn-draw-all' });

  appendElement(loaded.document, 'input', {
    className: 'phone-input',
    dataset: { row: 1 },
    value: '08111'
  });
  appendElement(loaded.document, 'input', {
    className: 'phone-input',
    dataset: { row: 2 },
    value: '08222'
  });
  appendElement(loaded.document, 'span', {
    className: 'drawing-badge',
    dataset: { row: 1 },
    textContent: ''
  });
  appendElement(loaded.document, 'span', {
    className: 'drawing-badge',
    dataset: { row: 2 },
    textContent: ''
  });

  app.tournament = { size: 2 };
  app.wireEvents();
  drawAllButton.dispatchEvent('click', {});

  assert.equal(loaded.getSavedParticipantsCalls().length, 1);
  assert.equal(loaded.getParticipants()[0].drawingNumber, 1);
  assert.equal(loaded.getParticipants()[1].drawingNumber, 2);
  assert.equal(app.participants, loaded.getParticipants());
});

test('score change keeps partial scores live without advancing winner', () => {
  const bracket = {
    rounds: [[{
      id: 'r0m0',
      p1: { id: 'p1', name: 'Alpha' },
      p2: { id: 'p2', name: 'Bravo' },
      score1: '',
      score2: '',
      winner: null,
      status: 'pending'
    }]]
  };
  const advanceCalls = [];
  const loaded = loadApp({
    bracket: bracket,
    advanceWinner: function (nextBracket, roundIdx, matchIdx, winner) {
      advanceCalls.push({ nextBracket: nextBracket, roundIdx: roundIdx, matchIdx: matchIdx, winner: winner });
      return nextBracket;
    }
  });
  const app = loaded.BilposApp;
  const bracketRenderArea = appendElement(loaded.document, 'div', { id: 'bracket-render-area' });
  const scoreInput = appendElement(loaded.document, 'input', {
    className: 'score-input',
    dataset: { round: 0, match: 0, player: 1 },
    value: '5'
  });

  app.bracket = bracket;
  app.renderBracket = function () {};
  app.renderStats = function () {};
  app.wireEvents();
  bracketRenderArea.dispatchEvent('change', { target: scoreInput });

  assert.equal(app.bracket.rounds[0][0].score1, '5');
  assert.equal(app.bracket.rounds[0][0].winner, null);
  assert.equal(app.bracket.rounds[0][0].status, 'live');
  assert.equal(advanceCalls.length, 0);
});

test('size change dispatches bilpos:bracket-activated event', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;

  app.tournament = { size: 32, fee: 0 };
  app.renderParticipantTable = function() {};
  app.renderStats = function() {};

  appendElement(loaded.document, 'input', { id: 'input-size', value: '16' });

  app.wireEvents();

  const sizeInput = loaded.document.getElementById('input-size');
  sizeInput.value = '16';
  sizeInput.dispatchEvent('change', { target: sizeInput });

  assert.ok(
    loaded.dispatchedEvents.includes('bilpos:bracket-activated'),
    'Expected bilpos:bracket-activated to be dispatched when size changes'
  );
});

test('clicking bracket nav item dispatches bilpos:bracket-activated event', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;

  app.tournament = { size: 32, fee: 0 };
  app.renderStats = function() {};
  app.renderParticipantTable = function() {};

  // Tambah nav items ke fake DOM
  const bracketNavItem = appendElement(loaded.document, 'div', {
    className: 'sidebar-nav-item',
    dataset: { section: 'bracket' }
  });
  appendElement(loaded.document, 'div', {
    id: 'section-bracket'
  });

  app.wireEvents();
  bracketNavItem.dispatchEvent('click', {});

  assert.ok(
    loaded.dispatchedEvents.includes('bilpos:bracket-activated'),
    'Expected bilpos:bracket-activated to be dispatched when bracket nav is clicked'
  );
});

test('bracket assignment rejects duplicate and out-of-range slots without writes', () => {
  const participants = [
    { id: 'row-1', slot: 1, drawingNumber: 1, name: 'Alpha' },
    { id: 'row-2', slot: 2, drawingNumber: 2, name: 'Bravo' }
  ];
  const loaded = loadApp({ participants: participants });
  const app = loaded.BilposApp;
  const tbody = appendElement(loaded.document, 'tbody', { id: 'participant-tbody' });
  app.tournament = { size: 2 };
  app.participants = participants;
  app.wireEvents();

  const duplicateInput = appendElement(loaded.document, 'input', {
    className: 'bracket-input',
    dataset: { row: 1 },
    value: '2'
  });
  tbody.dispatchEvent('change', { target: duplicateInput });
  duplicateInput.value = '3';
  tbody.dispatchEvent('change', { target: duplicateInput });

  assert.equal(loaded.getSavedParticipantsCalls().length, 0);
  assert.equal(loaded.getSavedBracketCalls().length, 0);
  assert.equal(loaded.getParticipants()[0].drawingNumber, 1);
  assert.equal(loaded.toastCalls.length, 2);
  assert.ok(loaded.toastCalls.every((toast) => toast.type === 'danger'));
});

test('bracket assignment cancels result reset or rebuilds and clears old results', () => {
  const participants = [
    { id: 'row-1', slot: 1, drawingNumber: 1, name: 'Alpha' },
    { id: 'row-2', slot: 2, drawingNumber: null, name: 'Bravo' }
  ];
  const oldBracket = {
    bracket: {
      size: 4,
      rounds: [[{
        id: 'r0m0',
        p1: participants[0],
        p2: participants[1],
        score1: 7,
        score2: 4,
        winner: participants[0],
        status: 'done'
      }]]
    },
    liveMatchIds: ['r0m0']
  };
  let confirmCalls = 0;
  let generatedBracket = null;
  const loaded = loadApp({
    participants: participants,
    bracket: oldBracket,
    confirm: function () {
      confirmCalls += 1;
      return confirmCalls > 1;
    },
    generateBracket: function (size, nextParticipants) {
      generatedBracket = {
        size: size,
        rounds: [[{
          id: 'r0m0',
          p1: nextParticipants[0],
          p2: nextParticipants[1],
          score1: '',
          score2: '',
          winner: null,
          status: 'pending'
        }]]
      };
      return generatedBracket;
    }
  });
  const app = loaded.BilposApp;
  const tbody = appendElement(loaded.document, 'tbody', { id: 'participant-tbody' });
  const input = appendElement(loaded.document, 'input', {
    className: 'bracket-input',
    dataset: { row: 1 },
    value: '3'
  });
  app.tournament = { size: 4 };
  app.participants = participants;
  app.wireEvents();

  tbody.dispatchEvent('change', { target: input });
  assert.equal(input.value, '1');
  assert.equal(loaded.getSavedParticipantsCalls().length, 0);
  assert.equal(loaded.getSavedBracketCalls().length, 0);

  input.value = '3';
  tbody.dispatchEvent('change', { target: input });

  assert.equal(loaded.getSavedParticipantsCalls().length, 1);
  assert.equal(loaded.getParticipants()[0].drawingNumber, 3);
  assert.equal(generatedBracket.rounds[0][0].score1, '');
  assert.equal(generatedBracket.rounds[0][0].winner, null);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.getSavedBracketCalls()[0].liveMatchIds)), []);
  assert.ok(loaded.dispatchedEvents.includes('bilpos:participants-updated'));
  assert.ok(loaded.dispatchedEvents.includes('bilpos:bracket-activated'));
});

test('sorting participants preserves their independently assigned drawing numbers', () => {
  const participants = [
    { id: 'row-1', slot: 1, drawingNumber: 1, name: 'Bravo', hc: '', status: '' },
    { id: 'row-2', slot: 2, drawingNumber: 2, name: 'Alpha', hc: '', status: '' }
  ];
  const loaded = loadApp({ participants: participants });
  const app = loaded.BilposApp;
  app.tournament = { size: 2 };
  app.participants = participants;
  [1, 2].forEach(function (row) {
    appendElement(loaded.document, 'tr', {
      id: 'row-' + row,
      dataset: { currentStatus: '' }
    });
  });
  appendElement(loaded.document, 'input', {
    className: 'name-input',
    dataset: { row: 1 },
    value: 'Bravo'
  });
  appendElement(loaded.document, 'select', {
    className: 'hc-select',
    dataset: { row: 1 },
    value: ''
  });
  appendElement(loaded.document, 'input', {
    className: 'hc-custom-input',
    dataset: { row: 1 },
    value: ''
  });
  appendElement(loaded.document, 'input', {
    className: 'name-input',
    dataset: { row: 2 },
    value: 'Alpha'
  });
  appendElement(loaded.document, 'select', {
    className: 'hc-select',
    dataset: { row: 2 },
    value: ''
  });
  appendElement(loaded.document, 'input', {
    className: 'hc-custom-input',
    dataset: { row: 2 },
    value: ''
  });

  app.sortParticipants('az');

  assert.deepEqual(JSON.parse(JSON.stringify(loaded.getParticipants().map((participant) => [
    participant.name,
    participant.drawingNumber
  ]))), [['Alpha', 2], ['Bravo', 1]]);
});

test('participant Excel controls export and open/reset the file picker', () => {
  const loaded = loadApp();
  const app = loaded.BilposApp;
  const exportButton = appendElement(loaded.document, 'button', { id: 'btn-export-excel' });
  const importButton = appendElement(loaded.document, 'button', { id: 'btn-import-excel' });
  const fileInput = appendElement(loaded.document, 'input', { id: 'import-excel-input' });
  const selectedFile = { name: 'roster.xlsx' };
  let exportCalls = 0;
  let importFile = null;
  let pickerCalls = 0;
  fileInput.files = [selectedFile];
  fileInput.value = 'C:\\fakepath\\roster.xlsx';
  fileInput.click = function () { pickerCalls += 1; };
  app.exportExcel = function () { exportCalls += 1; };
  app.importExcel = function (file) { importFile = file; };
  app.wireEvents();

  exportButton.dispatchEvent('click', {});
  importButton.dispatchEvent('click', {});
  fileInput.dispatchEvent('change', { target: fileInput });

  assert.equal(exportCalls, 1);
  assert.equal(pickerCalls, 1);
  assert.equal(importFile, selectedFile);
  assert.equal(fileInput.value, '');
});

test('Excel export builds a two-sheet workbook and writes an RNR filename', () => {
  const workbook = { SheetNames: ['Peserta', 'Bracket'], Sheets: {} };
  const exportCalls = [];
  const loaded = loadApp({
    participants: [{ id: 'row-1', name: 'Alpha', drawingNumber: 1 }],
    tournament: { size: 8, venue: 'Rack N Roll' },
    bracket: { bracket: { size: 8, rounds: [] }, liveMatchIds: [] },
    excelTransfer: {
      buildWorkbook: function (XLSX, participants, tournament, bracket) {
        exportCalls.push({ XLSX: XLSX, participants: participants, tournament: tournament, bracket: bracket });
        return workbook;
      }
    },
    xlsx: {
      writeFile: function (writtenWorkbook, filename) {
        exportCalls.push({ writtenWorkbook: writtenWorkbook, filename: filename });
      }
    }
  });

  loaded.BilposApp.exportExcel();

  assert.equal(exportCalls[0].participants[0].drawingNumber, 1);
  assert.equal(exportCalls[0].tournament.size, 8);
  assert.equal(exportCalls[0].bracket.bracket.size, 8);
  assert.equal(exportCalls[1].writtenWorkbook, workbook);
  assert.match(exportCalls[1].filename, /^rack-n-roll-peserta-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.equal(loaded.toastCalls[0].type, 'success');
});

test('Excel export generates a bracket when there is no saved bracket', () => {
  const participants = [{ id: 'row-1', name: 'Alpha', drawingNumber: 1 }];
  let generatedBracket = null;
  let exportedBracket = null;
  const loaded = loadApp({
    participants: participants,
    tournament: { size: 8, venue: 'Rack N Roll' },
    excelTransfer: {
      buildWorkbook: function (XLSX, roster, tournament, bracket) {
        exportedBracket = bracket;
        return {};
      }
    },
    xlsx: { writeFile: function () {} },
    generateBracket: function (size, roster) {
      generatedBracket = { size: size, roster: roster };
      return { size: size, rounds: [[{ id: 'r0m0' }]] };
    }
  });

  loaded.BilposApp.exportExcel();

  assert.equal(generatedBracket.size, 8);
  assert.equal(generatedBracket.roster, loaded.getParticipants());
  assert.equal(exportedBracket.bracket.size, 8);
  assert.deepEqual(Array.from(exportedBracket.liveMatchIds), []);
  assert.equal(loaded.toastCalls[0].type, 'success');
});

test('Excel import validates first then replaces roster, tournament, and saved bracket', () => {
  const inputFile = { name: 'rnr.xlsx' };
  const importedParticipants = [{ id: 'row-1', name: 'Alpha', drawingNumber: 1, status: 'cash' }];
  const importedBracket = { bracket: { size: 8, rounds: [] }, liveMatchIds: ['r0m0'] };
  const order = [];
  const loaded = loadApp({
    tournament: { size: 16, venue: 'Rack N Roll', fee: 100 },
    excelTransfer: {
      parseWorkbook: function (XLSX, workbook, currentTournament) {
        order.push('parse');
        assert.equal(currentTournament.venue, 'Rack N Roll');
        return {
          participants: importedParticipants,
          tournament: { size: 8, venue: currentTournament.venue, fee: currentTournament.fee },
          bracket: importedBracket
        };
      }
    },
    xlsx: { read: function () { return { SheetNames: ['Peserta', 'Bracket'], Sheets: {} }; } },
    FileReader: function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: 'workbook-bytes' } });
      };
    }
  });
  const app = loaded.BilposApp;
  app.tournament = { size: 16, venue: 'Rack N Roll', fee: 100 };
  app.renderParticipantTable = function () {};
  app.renderStats = function () {};
  const replaceTransfer = loaded.window.BilposStorage.replaceTournamentTransfer;
  loaded.window.BilposStorage.replaceTournamentTransfer = function (tournament, participants, bracket) {
    order.push('write');
    return replaceTransfer(tournament, participants, bracket);
  };

  app.importExcel(inputFile);

  assert.deepEqual(order, ['parse', 'write']);
  assert.equal(loaded.getTransferCalls().length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.getTransferCalls()[0].participants)), importedParticipants);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.getTransferCalls()[0].bracket)), importedBracket);
  assert.equal(loaded.getTournament().venue, 'Rack N Roll');
  assert.equal(loaded.getTournament().size, 8);
  assert.ok(loaded.dispatchedEvents.includes('bilpos:participants-updated'));
  assert.ok(loaded.dispatchedEvents.includes('bilpos:bracket-activated'));
  assert.equal(loaded.toastCalls[0].type, 'success');
});

test('invalid Excel import shows an error and does not write storage', () => {
  const loaded = loadApp({
    excelTransfer: {
      parseWorkbook: function () {
        throw new Error('Kolom Peserta tidak lengkap');
      }
    },
    xlsx: { read: function () { return { SheetNames: ['Peserta'], Sheets: {} }; } },
    FileReader: function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: 'invalid' } });
      };
    }
  });

  loaded.BilposApp.importExcel({ name: 'invalid.xlsx' });

  assert.equal(loaded.getTransferCalls().length, 0);
  assert.equal(loaded.toastCalls[0].type, 'danger');
  assert.match(loaded.toastCalls[0].message, /Kolom Peserta tidak lengkap/);
});

test('Excel import without a Bracket sheet generates a fresh scoreless bracket', () => {
  const importedParticipants = [{ id: 'row-1', name: 'Alpha', drawingNumber: 1 }];
  let generatedSize = null;
  const loaded = loadApp({
    excelTransfer: {
      parseWorkbook: function () {
        return {
          participants: importedParticipants,
          tournament: { size: 8, venue: 'Rack N Roll' },
          bracket: null
        };
      }
    },
    xlsx: { read: function () { return { SheetNames: ['Peserta'], Sheets: {} }; } },
    FileReader: function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: 'workbook-bytes' } });
      };
    },
    generateBracket: function (size) {
      generatedSize = size;
      return { size: size, rounds: [] };
    }
  });

  loaded.BilposApp.importExcel({ name: 'roster.xlsx' });

  assert.equal(generatedSize, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.getTransferCalls()[0].bracket)), {
    bracket: { size: 8, rounds: [] },
    liveMatchIds: []
  });
  assert.equal(loaded.toastCalls[0].type, 'success');
});

test('Excel actions report an unavailable workbook library', () => {
  const loaded = loadApp({ xlsx: undefined });

  loaded.BilposApp.exportExcel();
  loaded.BilposApp.importExcel({ name: 'roster.xlsx' });

  assert.equal(loaded.toastCalls.length, 2);
  assert.ok(loaded.toastCalls.every((toast) => toast.type === 'danger'));
  assert.equal(loaded.getTransferCalls().length, 0);
});

test('Excel import reports a storage replacement failure without success notification', () => {
  const loaded = loadApp({
    excelTransfer: {
      parseWorkbook: function () {
        return {
          participants: [],
          tournament: { size: 8 },
          bracket: null
        };
      }
    },
    xlsx: { read: function () { return { SheetNames: ['Peserta'], Sheets: {} }; } },
    FileReader: function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: 'workbook-bytes' } });
      };
    }
  });
  loaded.window.BilposStorage.replaceTournamentTransfer = function () {
    throw new Error('storage full');
  };

  loaded.BilposApp.importExcel({ name: 'roster.xlsx' });

  assert.equal(loaded.toastCalls.length, 1);
  assert.equal(loaded.toastCalls[0].type, 'danger');
  assert.match(loaded.toastCalls[0].message, /storage full/);
});
