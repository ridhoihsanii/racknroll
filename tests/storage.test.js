const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStorage(initialValues, failKey) {
  const values = Object.assign({}, initialValues || {});
  let failurePending = Boolean(failKey);
  const localStorage = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function (key, value) {
      if (failurePending && key === failKey) {
        failurePending = false;
        throw new Error('write failed');
      }
      values[key] = String(value);
    },
    removeItem: function (key) {
      delete values[key];
    }
  };
  const context = {
    window: {},
    localStorage: localStorage,
    console: { warn: function () {}, error: function () {} }
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(process.cwd(), 'assets', 'js', 'storage.js'), 'utf8'),
    context
  );
  return { storage: context.window.BilposStorage, values: values };
}

test('replaceTournamentTransfer writes tournament, participants, and bracket', () => {
  const loaded = loadStorage();
  const tournament = { size: 8, venue: 'Rack N Roll' };
  const participants = [{ id: 'row-1', name: 'Alpha' }];
  const bracket = { bracket: { size: 8, rounds: [] }, liveMatchIds: [] };

  loaded.storage.replaceTournamentTransfer(tournament, participants, bracket);

  assert.deepEqual(JSON.parse(loaded.values.bilpos_tournament), {
    venue: 'Rack N Roll',
    size: 8,
    status: 'setup',
    currentRound: 0,
    createdAt: null
  });
  assert.deepEqual(JSON.parse(loaded.values.bilpos_participants), participants);
  assert.deepEqual(JSON.parse(loaded.values.bilpos_bracket), bracket);
});

test('replaceTournamentTransfer rolls back prior values and rethrows write errors', () => {
  const initialValues = {
    bilpos_tournament: '{"size":32,"venue":"Old"}',
    bilpos_participants: '[{"id":"old"}]',
    bilpos_bracket: '{"bracket":{"size":32,"rounds":[]}}'
  };
  const loaded = loadStorage(initialValues, 'bilpos_participants');

  assert.throws(function () {
    loaded.storage.replaceTournamentTransfer(
      { size: 8, venue: 'New' },
      [{ id: 'new' }],
      { bracket: { size: 8, rounds: [] }, liveMatchIds: [] }
    );
  }, /write failed/);
  assert.deepEqual(loaded.values, initialValues);
});

test('replaceTournamentTransfer reports when rollback cannot restore previous data', () => {
  const values = {
    bilpos_tournament: '{"size":32,"venue":"Old"}',
    bilpos_participants: '[{"id":"old"}]',
    bilpos_bracket: '{"bracket":{"size":32,"rounds":[]}}'
  };
  let failedTransferWrite = false;
  let failedRollbackWrite = false;
  const localStorage = {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function (key, value) {
      if (key === 'bilpos_participants' && !failedTransferWrite) {
        failedTransferWrite = true;
        throw new Error('write failed');
      }
      if (key === 'bilpos_tournament' && failedTransferWrite && !failedRollbackWrite) {
        failedRollbackWrite = true;
        throw new Error('rollback blocked');
      }
      values[key] = String(value);
    },
    removeItem: function (key) {
      delete values[key];
    }
  };
  const context = {
    window: {},
    localStorage: localStorage,
    console: { warn: function () {}, error: function () {} }
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(process.cwd(), 'assets', 'js', 'storage.js'), 'utf8'),
    context
  );

  assert.throws(function () {
    context.window.BilposStorage.replaceTournamentTransfer(
      { size: 8, venue: 'New' },
      [{ id: 'new' }],
      { bracket: { size: 8, rounds: [] }, liveMatchIds: [] }
    );
  }, /rollback.*blocked/i);
});
