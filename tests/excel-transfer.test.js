const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadExcelTransfer() {
  const context = { window: {} };
  const source = fs.readFileSync(
    path.join(process.cwd(), 'assets', 'js', 'excel-transfer.js'),
    'utf8'
  );

  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.BilposExcelTransfer;
}

function createXlsxStub(sheets) {
  return {
    utils: {
      book_new: function () {
        return { SheetNames: [], Sheets: {} };
      },
      json_to_sheet: function (rows, options) {
        return {
          __rows: rows,
          __headers: options && options.header ? options.header : (rows.length ? Object.keys(rows[0]) : [])
        };
      },
      book_append_sheet: function (workbook, worksheet, name) {
        workbook.SheetNames.push(name);
        workbook.Sheets[name] = worksheet;
      },
      sheet_to_json: function (worksheet, options) {
        if (options && options.header === 1) {
          return [worksheet.__headers || []].concat((worksheet.__rows || []).map(function (row) {
            return (worksheet.__headers || []).map(function (header) { return row[header]; });
          }));
        }
        return worksheet.__rows;
      }
    },
    read: function () {
      return { SheetNames: Object.keys(sheets), Sheets: sheets };
    },
    writeFile: function () {}
  };
}

function createEmptyBracket(size) {
  const rounds = [];
  let matchCount = Math.ceil(size / 2);
  let roundIndex = 0;

  while (matchCount > 0) {
    const round = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      round.push({
        id: 'r' + roundIndex + 'm' + matchIndex,
        p1: null,
        p2: null,
        score1: '',
        score2: '',
        winner: null,
        status: 'pending'
      });
    }
    rounds.push(round);
    if (matchCount === 1) break;
    matchCount = Math.ceil(matchCount / 2);
    roundIndex += 1;
  }
  return { size: size, rounds: rounds };
}

test('buildWorkbook writes exact participant columns and payment/slot values', () => {
  const transfer = loadExcelTransfer();
  const XLSX = createXlsxStub({});
  const workbook = transfer.buildWorkbook(
    XLSX,
    [
      { id: 'p1', name: 'Alpha', hc: 'HC 3B', status: 'cash', drawingNumber: 1 },
      { id: 'p2', name: 'Bravo', hc: 'HC 3N', status: 'tf', drawingNumber: 2 },
      { id: 'p3', name: 'Charlie', hc: '', status: '', drawingNumber: null }
    ],
    { size: 8 },
    { bracket: createEmptyBracket(8), liveMatchIds: [] }
  );

  assert.deepEqual(Object.keys(workbook.Sheets.Peserta.__rows[0]), [
    'Pembayaran', 'Nama', 'HC', 'Bracket', 'Ukuran Tournament'
  ]);
  assert.deepEqual(workbook.SheetNames, ['Peserta', 'Bracket']);
  assert.equal(workbook.Sheets.Peserta.__rows[0].Pembayaran, 'CASH');
  assert.equal(workbook.Sheets.Peserta.__rows[0].Bracket, 1);
  assert.equal(workbook.Sheets.Peserta.__rows[0]['Ukuran Tournament'], 8);
  assert.equal(workbook.Sheets.Peserta.__rows[1].Pembayaran, 'TF');
  assert.equal(workbook.Sheets.Peserta.__rows[1].Bracket, 2);
  assert.equal(workbook.Sheets.Peserta.__rows[2].Pembayaran, '');
  assert.equal(workbook.Sheets.Peserta.__rows[2].Bracket, '');
});

test('empty roster export retains tournament size and imports as an empty roster', () => {
  const transfer = loadExcelTransfer();
  const XLSX = createXlsxStub({});
  const workbook = transfer.buildWorkbook(
    XLSX,
    [],
    { size: 16 },
    { bracket: createEmptyBracket(16), liveMatchIds: [] }
  );
  const result = transfer.parseWorkbook(XLSX, workbook, { size: 32, venue: 'RNR' });

  assert.equal(result.tournament.size, 16);
  assert.deepEqual(JSON.parse(JSON.stringify(result.participants)), []);
  assert.equal(result.bracket.bracket.rounds.length, 4);
});

test('buildWorkbook rejects a missing or incomplete saved bracket', () => {
  const transfer = loadExcelTransfer();

  assert.throws(function () {
    transfer.buildWorkbook(createXlsxStub({}), [], { size: 2 }, null);
  }, /Bracket/);
});

test('parseWorkbook rejects an empty but present Bracket sheet', () => {
  const transfer = loadExcelTransfer();
  const workbook = createWorkbook([createParticipantRow('', 'Alpha', '', 1, 2)], []);
  workbook.Sheets.Bracket.__headers = transfer.BRACKET_COLUMNS.slice();

  assert.throws(function () {
    transfer.parseWorkbook(createXlsxStub({}), workbook, { size: 2 });
  }, /Bracket.*match/);
});

test('buildWorkbook preserves the legacy single LIVE match id', () => {
  const transfer = loadExcelTransfer();
  const workbook = transfer.buildWorkbook(
    createXlsxStub({}),
    [],
    { size: 2 },
    {
      bracket: {
        size: 2,
        rounds: [[{
          id: 'r0m0',
          p1: null,
          p2: null,
          score1: '',
          score2: '',
          winner: null,
          status: 'pending'
        }]]
      },
      liveMatchId: 'r0m0'
    }
  );

  assert.equal(workbook.Sheets.Bracket.__rows[0].LIVE, true);
});

function createParticipantRow(payment, name, hc, drawingNumber, size) {
  return {
    'Pembayaran': payment,
    'Nama': name,
    'HC': hc,
    'Bracket': drawingNumber,
    'Ukuran Tournament': size
  };
}

function createWorkbook(participantRows, bracketRows) {
  const sheets = {
    Peserta: {
      __rows: participantRows,
      __headers: participantRows.length ? Object.keys(participantRows[0]) : []
    }
  };
  if (bracketRows) {
    sheets.Bracket = { __rows: bracketRows, __headers: Object.keys(bracketRows[0] || {}) };
  }
  return { SheetNames: Object.keys(sheets), Sheets: sheets };
}

test('parseWorkbook replaces roster values and retains current tournament settings', () => {
  const transfer = loadExcelTransfer();
  const result = transfer.parseWorkbook(
    createXlsxStub({}),
    createWorkbook([
      createParticipantRow('CASH', 'Alpha', 'HC 3B', 1, 8),
      createParticipantRow('TF', 'Bravo', 'HC 3N', '', 8)
    ]),
    { size: 32, venue: 'Rack N Roll', fee: 100 }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(result.participants.map(function (p) {
    return [p.id, p.slot, p.name, p.hc, p.drawingNumber, p.status];
  }))), [
    ['row-1', 1, 'Alpha', 'HC 3B', 1, 'cash'],
    ['row-2', 2, 'Bravo', 'HC 3N', null, 'tf']
  ]);
  assert.equal(result.tournament.size, 8);
  assert.equal(result.tournament.venue, 'Rack N Roll');
  assert.equal(result.tournament.fee, 100);
  assert.equal(result.bracket, null);
});

test('parseWorkbook rejects duplicate, fractional, and out-of-range bracket assignments', () => {
  const transfer = loadExcelTransfer();
  const XLSX = createXlsxStub({});
  const currentTournament = { size: 8 };

  [
    [createParticipantRow('', 'Alpha', '', 1, 8), createParticipantRow('', 'Bravo', '', 1, 8)],
    [createParticipantRow('', 'Alpha', '', 1.5, 8)],
    [createParticipantRow('', 'Alpha', '', 0, 8)],
    [createParticipantRow('', 'Alpha', '', 9, 8)]
  ].forEach(function (rows) {
    assert.throws(function () {
      transfer.parseWorkbook(XLSX, createWorkbook(rows), currentTournament);
    }, /Bracket slot/);
  });
});

test('validateDrawingNumber accepts empty slots and rejects conflicts or invalid ranges', () => {
  const transfer = loadExcelTransfer();
  const participants = [
    { id: 'p1', drawingNumber: 1 },
    { id: 'p2', drawingNumber: 2 }
  ];

  assert.equal(transfer.validateDrawingNumber('', 8, participants, 'p1'), null);
  assert.equal(transfer.validateDrawingNumber('3', 8, participants, 'p1'), 3);
  assert.throws(function () {
    transfer.validateDrawingNumber('2', 8, participants, 'p1');
  }, /Bracket slot tidak boleh duplikat/);
  assert.throws(function () {
    transfer.validateDrawingNumber('1.5', 8, participants, 'p1');
  }, /bilangan bulat/);
  assert.throws(function () {
    transfer.validateDrawingNumber('9', 8, participants, 'p1');
  }, /di luar batas/);
});

test('parseWorkbook rejects a missing required participant column', () => {
  const transfer = loadExcelTransfer();
  const rows = [{
    'Pembayaran': '',
    'Nama': 'Alpha',
    'HC': '',
    'Bracket': 1
  }];

  assert.throws(function () {
    transfer.parseWorkbook(
      createXlsxStub({}),
      createWorkbook(rows),
      { size: 8 }
    );
  }, /Kolom Peserta tidak lengkap/);
});

test('parseWorkbook rejects incomplete Bracket columns and unsupported payment values', () => {
  const transfer = loadExcelTransfer();
  const XLSX = createXlsxStub({});

  assert.throws(function () {
    transfer.parseWorkbook(
      XLSX,
      createWorkbook([createParticipantRow('', 'Alpha', '', 1, 2)], [{ 'Ronde': 0 }]),
      { size: 2 }
    );
  }, /Kolom Bracket tidak lengkap/);

  assert.throws(function () {
    transfer.parseWorkbook(
      XLSX,
      createWorkbook([createParticipantRow('CARD', 'Alpha', '', 1, 2)]),
      { size: 2 }
    );
  }, /Pembayaran harus/);
});

test('parseWorkbook restores bracket rows, results, and LIVE state', () => {
  const transfer = loadExcelTransfer();
  const row = {
    'Ronde': 0,
    'Match': 0,
    'ID Match': 'r0m0',
    'P1 ID': 'alpha-id',
    'P1 Nama': 'Alpha',
    'P1 HC': 'HC 3B',
    'P1 Bracket': 1,
    'P1 BYE': false,
    'Skor P1': 7,
    'P2 ID': 'bravo-id',
    'P2 Nama': 'Bravo',
    'P2 HC': 'HC 3N',
    'P2 Bracket': 2,
    'P2 BYE': false,
    'Skor P2': 4,
    'Pemenang ID': 'alpha-id',
    'Pemenang Nama': 'Alpha',
    'Pemenang HC': 'HC 3B',
    'Pemenang Bracket': 1,
    'Pemenang BYE': false,
    'Status': 'done',
    'LIVE': true
  };
  const result = transfer.parseWorkbook(
    createXlsxStub({}),
    createWorkbook([
      createParticipantRow('CASH', 'Alpha', 'HC 3B', 1, 2),
      createParticipantRow('TF', 'Bravo', 'HC 3N', 2, 2)
    ], [row]),
    { size: 16, venue: 'Rack N Roll' }
  );
  const match = result.bracket.bracket.rounds[0][0];

  assert.equal(result.bracket.bracket.size, 2);
  assert.equal(result.participants[0].id, 'row-1');
  assert.equal(result.participants[1].id, 'row-2');
  assert.equal(match.p1.id, 'row-1');
  assert.equal(match.p2.id, 'row-2');
  assert.equal(match.id, 'r0m0');
  assert.equal(match.p1.name, 'Alpha');
  assert.equal(match.p2.name, 'Bravo');
  assert.equal(match.score1, 7);
  assert.equal(match.score2, 4);
  assert.equal(match.winner.id, 'row-1');
  assert.equal(match.status, 'done');
  assert.deepEqual(JSON.parse(JSON.stringify(result.bracket.liveMatchIds)), ['r0m0']);
});

test('parseWorkbook fills a pending BYE slot from roster while preserving existing results', () => {
  const transfer = loadExcelTransfer();
  const bracketRows = [
    {
      'Ronde': 0, 'Match': 0, 'ID Match': 'r0m0',
      'P1 ID': 'row-1', 'P1 Nama': 'Alpha', 'P1 HC': '', 'P1 Bracket': 1, 'P1 BYE': false, 'Skor P1': 3,
      'P2 ID': 'row-2', 'P2 Nama': 'Bravo', 'P2 HC': '', 'P2 Bracket': 2, 'P2 BYE': false, 'Skor P2': 1,
      'Pemenang ID': 'row-1', 'Pemenang Nama': 'Alpha', 'Pemenang HC': '', 'Pemenang Bracket': 1,
      'Pemenang BYE': false, 'Status': 'done', 'LIVE': false
    },
    {
      'Ronde': 0, 'Match': 1, 'ID Match': 'r0m1',
      'P1 ID': '', 'P1 Nama': 'BYE', 'P1 HC': '', 'P1 Bracket': 3, 'P1 BYE': true, 'Skor P1': '',
      'P2 ID': '', 'P2 Nama': 'BYE', 'P2 HC': '', 'P2 Bracket': 4, 'P2 BYE': true, 'Skor P2': '',
      'Pemenang ID': '', 'Pemenang Nama': '', 'Pemenang HC': '', 'Pemenang Bracket': '',
      'Pemenang BYE': false, 'Status': 'pending', 'LIVE': false
    },
    {
      'Ronde': 1, 'Match': 0, 'ID Match': 'r1m0',
      'P1 ID': '', 'P1 Nama': '', 'P1 HC': '', 'P1 Bracket': '', 'P1 BYE': false, 'Skor P1': '',
      'P2 ID': '', 'P2 Nama': '', 'P2 HC': '', 'P2 Bracket': '', 'P2 BYE': false, 'Skor P2': '',
      'Pemenang ID': '', 'Pemenang Nama': '', 'Pemenang HC': '', 'Pemenang Bracket': '',
      'Pemenang BYE': false, 'Status': 'pending', 'LIVE': false
    }
  ];
  const result = transfer.parseWorkbook(
    createXlsxStub({}),
    createWorkbook([
      createParticipantRow('TF', 'Charlie', '', 3, 4),
      createParticipantRow('TF', 'Bravo', '', 2, 4),
      createParticipantRow('TF', 'Alpha', '', 1, 4)
    ], bracketRows),
    { size: 4 }
  );

  assert.equal(result.bracket.bracket.rounds[0][0].score1, 3);
  assert.equal(result.bracket.bracket.rounds[0][0].winner.id, 'row-3');
  assert.equal(result.bracket.bracket.rounds[0][1].p1.id, 'row-1');
  assert.equal(result.bracket.bracket.rounds[0][1].p1.name, 'Charlie');
  assert.equal(result.bracket.bracket.rounds[0][1].p2.name, 'BYE');
});

test('parseWorkbook advances saved winners into pending next-round matches', () => {
  const transfer = loadExcelTransfer();
  const result = transfer.parseWorkbook(
    createXlsxStub({}),
    createWorkbook([
      createParticipantRow('TF', 'Alpha', '', 1, 4),
      createParticipantRow('TF', 'Bravo', '', 2, 4),
      createParticipantRow('TF', 'Charlie', '', 3, 4)
    ], [
      {
        'Ronde': 0, 'Match': 0, 'ID Match': 'r0m0',
        'P1 ID': 'alpha-id', 'P1 Nama': 'Alpha', 'P1 HC': '', 'P1 Bracket': 1, 'P1 BYE': false, 'Skor P1': 3,
        'P2 ID': 'bravo-id', 'P2 Nama': 'Bravo', 'P2 HC': '', 'P2 Bracket': 2, 'P2 BYE': false, 'Skor P2': 1,
        'Pemenang ID': 'alpha-id', 'Pemenang Nama': 'Alpha', 'Pemenang HC': '', 'Pemenang Bracket': 1,
        'Pemenang BYE': false, 'Status': 'done', 'LIVE': false
      },
      {
        'Ronde': 0, 'Match': 1, 'ID Match': 'r0m1',
        'P1 ID': 'charlie-id', 'P1 Nama': 'Charlie', 'P1 HC': '', 'P1 Bracket': 3, 'P1 BYE': false, 'Skor P1': '',
        'P2 ID': '', 'P2 Nama': 'BYE', 'P2 HC': '', 'P2 Bracket': 4, 'P2 BYE': true, 'Skor P2': '',
        'Pemenang ID': 'charlie-id', 'Pemenang Nama': 'Charlie', 'Pemenang HC': '', 'Pemenang Bracket': 3,
        'Pemenang BYE': false, 'Status': 'done', 'LIVE': false
      },
      {
        'Ronde': 1, 'Match': 0, 'ID Match': 'r1m0',
        'P1 ID': 'bravo-id', 'P1 Nama': 'Bravo', 'P1 HC': '', 'P1 Bracket': 2, 'P1 BYE': false, 'Skor P1': '',
        'P2 ID': 'charlie-id', 'P2 Nama': 'Charlie', 'P2 HC': '', 'P2 Bracket': 3, 'P2 BYE': false, 'Skor P2': '',
        'Pemenang ID': '', 'Pemenang Nama': '', 'Pemenang HC': '', 'Pemenang Bracket': '',
        'Pemenang BYE': false, 'Status': 'pending', 'LIVE': false
      }
    ]),
    { size: 4 }
  );
  const firstRoundMatch = result.bracket.bracket.rounds[0][0];
  const finalMatch = result.bracket.bracket.rounds[1][0];

  assert.equal(firstRoundMatch.score1, 3);
  assert.equal(firstRoundMatch.winner.id, 'row-1');
  assert.equal(finalMatch.p1.id, 'row-1');
  assert.equal(finalMatch.p1.name, 'Alpha');
  assert.equal(finalMatch.p2.id, 'row-3');
});

test('buildWorkbook and parseWorkbook round-trip multiple rounds and LIVE matches', () => {
  const transfer = loadExcelTransfer();
  const XLSX = createXlsxStub({});
  const participants = [
    { id: 'row-1', name: 'Alpha', hc: 'HC 3B', status: 'cash', drawingNumber: 1 },
    { id: 'row-2', name: 'Bravo', hc: 'HC 3N', status: 'tf', drawingNumber: 2 },
    { id: 'row-3', name: 'Charlie', hc: 'HC 3A', status: '', drawingNumber: 3 }
  ];
  const bracketParticipants = participants.map(function (participant) {
    return {
      id: participant.id,
      name: participant.name,
      hc: participant.hc,
      drawingNumber: participant.drawingNumber
    };
  });
  const bracket = {
    size: 4,
    rounds: [
      [
        {
          id: 'r0m0',
          p1: bracketParticipants[0],
          p2: bracketParticipants[1],
          score1: 7,
          score2: 4,
          winner: bracketParticipants[0],
          status: 'done'
        },
        {
          id: 'r0m1',
          p1: bracketParticipants[2],
          p2: { id: null, name: 'BYE', hc: '', drawingNumber: 4 },
          score1: '',
          score2: '',
          winner: bracketParticipants[2],
          status: 'done'
        }
      ],
      [{
        id: 'r1m0',
        p1: bracketParticipants[0],
        p2: bracketParticipants[2],
        score1: 2,
        score2: '',
        winner: null,
        status: 'live'
      }]
    ]
  };
  const liveMatchIds = ['r1m0'];
  const workbook = transfer.buildWorkbook(
    XLSX,
    participants,
    { size: 4 },
    { bracket: bracket, liveMatchIds: liveMatchIds }
  );
  assert.deepEqual(Object.keys(workbook.Sheets.Bracket.__rows[0]), [
    'Ronde', 'Match', 'ID Match', 'P1 ID', 'P1 Nama', 'P1 HC', 'P1 Bracket', 'P1 BYE', 'Skor P1',
    'P2 ID', 'P2 Nama', 'P2 HC', 'P2 Bracket', 'P2 BYE', 'Skor P2', 'Pemenang ID',
    'Pemenang Nama', 'Pemenang HC', 'Pemenang Bracket', 'Pemenang BYE', 'Status', 'LIVE'
  ]);
  const result = transfer.parseWorkbook(XLSX, workbook, { size: 32, venue: 'Rack N Roll' });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.participants.map(function (participant) {
      return [participant.name, participant.hc, participant.status, participant.drawingNumber];
    }))),
    [
      ['Alpha', 'HC 3B', 'cash', 1],
      ['Bravo', 'HC 3N', 'tf', 2],
      ['Charlie', 'HC 3A', '', 3]
    ]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result.bracket.bracket)), JSON.parse(JSON.stringify(bracket)));
  assert.deepEqual(JSON.parse(JSON.stringify(result.bracket.liveMatchIds)), liveMatchIds);
});

test('parseWorkbook rejects bracket indexes and winners that do not match the sides', () => {
  const transfer = loadExcelTransfer();
  const row = {
    'Ronde': 0,
    'Match': 1,
    'ID Match': 'r0m1',
    'P1 ID': 'alpha-id',
    'P1 Nama': 'Alpha',
    'P1 HC': '',
    'P1 Bracket': 1,
    'P1 BYE': false,
    'Skor P1': '',
    'P2 ID': 'bravo-id',
    'P2 Nama': 'Bravo',
    'P2 HC': '',
    'P2 Bracket': 2,
    'P2 BYE': false,
    'Skor P2': '',
    'Pemenang ID': 'outsider',
    'Pemenang Nama': 'Outside',
    'Pemenang HC': '',
    'Pemenang Bracket': '',
    'Pemenang BYE': false,
    'Status': 'done',
    'LIVE': false
  };

  assert.throws(function () {
    transfer.parseWorkbook(
      createXlsxStub({}),
      createWorkbook([createParticipantRow('', 'Alpha', '', 1, 2)], [Object.assign({}, row, {
        'Match': 0
      })]),
      { size: 2 }
    );
  }, /Pemenang tidak sesuai/);

  assert.throws(function () {
    transfer.parseWorkbook(
      createXlsxStub({}),
      createWorkbook([createParticipantRow('', 'Alpha', '', 1, 4)], [Object.assign({}, row, {
        'Pemenang ID': '',
        'Pemenang Nama': '',
        'Status': 'pending'
      })]),
      { size: 4 }
    );
  }, /Indeks Bracket tidak berurutan/);
});

test('parseWorkbook rejects ambiguous participant identities between sheets', () => {
  const transfer = loadExcelTransfer();
  const row = {
    'Ronde': 0,
    'Match': 0,
    'ID Match': 'r0m0',
    'P1 ID': 'source-id',
    'P1 Nama': 'Duplicate',
    'P1 HC': 'HC 3B',
    'P1 Bracket': '',
    'P1 BYE': false,
    'Skor P1': '',
    'P2 ID': '',
    'P2 Nama': '',
    'P2 HC': '',
    'P2 Bracket': '',
    'P2 BYE': false,
    'Skor P2': '',
    'Pemenang ID': '',
    'Pemenang Nama': '',
    'Pemenang HC': '',
    'Pemenang Bracket': '',
    'Pemenang BYE': false,
    'Status': 'pending',
    'LIVE': false
  };

  assert.throws(function () {
    transfer.parseWorkbook(
      createXlsxStub({}),
      createWorkbook([
        createParticipantRow('', 'Duplicate', 'HC 3B', '', 2),
        createParticipantRow('', 'Duplicate', 'HC 3B', '', 2)
      ], [row]),
      { size: 2 }
    );
  }, /unik/);
});

test('parseWorkbook rejects a roster slot missing from the first-round bracket', () => {
  const transfer = loadExcelTransfer();
  const row = {
    'Ronde': 0,
    'Match': 0,
    'ID Match': 'r0m0',
    'P1 ID': 'alpha-id',
    'P1 Nama': 'Alpha',
    'P1 HC': '',
    'P1 Bracket': 1,
    'P1 BYE': false,
    'Skor P1': '',
    'P2 ID': '',
    'P2 Nama': '',
    'P2 HC': '',
    'P2 Bracket': '',
    'P2 BYE': false,
    'Skor P2': '',
    'Pemenang ID': '',
    'Pemenang Nama': '',
    'Pemenang HC': '',
    'Pemenang Bracket': '',
    'Pemenang BYE': false,
    'Status': 'pending',
    'LIVE': false
  };

  assert.throws(function () {
    transfer.parseWorkbook(
      createXlsxStub({}),
      createWorkbook([
        createParticipantRow('', 'Alpha', '', 1, 2),
        createParticipantRow('', 'Bravo', '', 2, 2)
      ], [row]),
      { size: 2 }
    );
  }, /slot.*Bracket|tidak ditemukan/i);
});
