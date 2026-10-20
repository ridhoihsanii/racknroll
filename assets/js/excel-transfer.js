(function (root) {
  var PARTICIPANT_COLUMNS = ['Pembayaran', 'Nama', 'HC', 'Bracket', 'Ukuran Tournament'];
  var BRACKET_COLUMNS = [
    'Ronde', 'Match', 'ID Match',
    'P1 ID', 'P1 Nama', 'P1 HC', 'P1 Bracket', 'P1 BYE', 'Skor P1',
    'P2 ID', 'P2 Nama', 'P2 HC', 'P2 Bracket', 'P2 BYE', 'Skor P2',
    'Pemenang ID', 'Pemenang Nama', 'Pemenang HC', 'Pemenang Bracket', 'Pemenang BYE',
    'Status', 'LIVE'
  ];

  function participantCell(participant, key) {
    return participant && participant[key] != null ? participant[key] : '';
  }

  function isBye(participant) {
    return Boolean(participant && participant.name === 'BYE');
  }

  function matchToRow(match, roundIndex, matchIndex, liveMatchIds) {
    var p1 = match.p1;
    var p2 = match.p2;
    var winner = match.winner;

    return {
      'Ronde': roundIndex,
      'Match': matchIndex,
      'ID Match': match.id || '',
      'P1 ID': participantCell(p1, 'id'),
      'P1 Nama': participantCell(p1, 'name'),
      'P1 HC': participantCell(p1, 'hc'),
      'P1 Bracket': participantCell(p1, 'drawingNumber'),
      'P1 BYE': isBye(p1),
      'Skor P1': match.score1 == null ? '' : match.score1,
      'P2 ID': participantCell(p2, 'id'),
      'P2 Nama': participantCell(p2, 'name'),
      'P2 HC': participantCell(p2, 'hc'),
      'P2 Bracket': participantCell(p2, 'drawingNumber'),
      'P2 BYE': isBye(p2),
      'Skor P2': match.score2 == null ? '' : match.score2,
      'Pemenang ID': participantCell(winner, 'id'),
      'Pemenang Nama': participantCell(winner, 'name'),
      'Pemenang HC': participantCell(winner, 'hc'),
      'Pemenang Bracket': participantCell(winner, 'drawingNumber'),
      'Pemenang BYE': isBye(winner),
      'Status': match.status || 'pending',
      'LIVE': Boolean(liveMatchIds.indexOf(match.id) !== -1)
    };
  }

  function buildWorkbook(XLSX, participants, tournament, savedBracket) {
    if (!XLSX || !XLSX.utils) {
      throw new Error('Library Excel tidak tersedia');
    }

    var size = parseInt(tournament && tournament.size, 10) || 32;
    var rows = (Array.isArray(participants) ? participants : []).map(function (participant) {
      var status = participant && participant.status;
      return {
        'Pembayaran': status === 'cash' ? 'CASH' : (status === 'tf' ? 'TF' : ''),
        'Nama': participant && participant.name || '',
        'HC': participant && participant.hc || '',
        'Bracket': participant && participant.drawingNumber != null ? participant.drawingNumber : '',
        'Ukuran Tournament': size
      };
    });
    if (!rows.length) {
      rows.push({
        'Pembayaran': '',
        'Nama': '',
        'HC': '',
        'Bracket': '',
        'Ukuran Tournament': size
      });
    }
    var bracketData = savedBracket && savedBracket.bracket;
    var liveMatchIds = savedBracket && Array.isArray(savedBracket.liveMatchIds)
      ? savedBracket.liveMatchIds
      : (savedBracket && savedBracket.liveMatchId ? [savedBracket.liveMatchId] : []);
    var bracketRows = [];

    validateBracketShape(bracketData, size);
    bracketData.rounds.forEach(function (round, roundIndex) {
      round.forEach(function (match, matchIndex) {
        bracketRows.push(matchToRow(match, roundIndex, matchIndex, liveMatchIds));
      });
    });

    var workbook = XLSX.utils.book_new();
    var participantSheet = XLSX.utils.json_to_sheet(rows, { header: PARTICIPANT_COLUMNS });
    var bracketSheet = XLSX.utils.json_to_sheet(bracketRows, { header: BRACKET_COLUMNS });
    XLSX.utils.book_append_sheet(workbook, participantSheet, 'Peserta');
    XLSX.utils.book_append_sheet(workbook, bracketSheet, 'Bracket');
    return workbook;
  }

  function readSheetRows(XLSX, workbook, name, requiredColumns) {
    var sheet = workbook && workbook.Sheets && workbook.Sheets[name];
    var matrix;
    var headers;
    var rows;

    if (!sheet) {
      throw new Error('Sheet ' + name + ' tidak ditemukan');
    }
    matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    headers = matrix && matrix.length ? matrix[0].map(function (value) {
      return String(value == null ? '' : value).trim();
    }) : [];
    if (!requiredColumns.every(function (column) { return headers.indexOf(column) !== -1; })) {
      throw new Error('Kolom ' + name + ' tidak lengkap');
    }
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
    return Array.isArray(rows) ? rows : [];
  }

  function isBlank(value) {
    return value == null || String(value).trim() === '';
  }

  function parseInteger(value, label, min, max) {
    var text = String(value == null ? '' : value).trim();
    var number;
    if (!/^\d+$/.test(text)) {
      throw new Error(label + ' harus berupa bilangan bulat');
    }
    number = Number(text);
    if (!isFinite(number) || number < min || number > max) {
      throw new Error(label + ' di luar batas yang diizinkan');
    }
    return number;
  }

  function validateDrawingNumber(value, size, participants, excludeId) {
    var drawingNumber = parseOptionalDrawingNumber(value, size);
    var assigned = Array.isArray(participants) ? participants : [];
    if (drawingNumber != null && assigned.some(function (participant) {
      return participant &&
        String(participant.id) !== String(excludeId) &&
        Number(participant.drawingNumber) === drawingNumber;
    })) {
      throw new Error('Bracket slot tidak boleh duplikat');
    }
    return drawingNumber;
  }

  function parseOptionalDrawingNumber(value, size, label) {
    if (isBlank(value)) return null;
    return parseInteger(value, label || 'Bracket slot', 1, size);
  }

  function normalizePayment(value) {
    var normalized = String(value == null ? '' : value).trim().toUpperCase();
    if (!normalized || normalized === 'BELUM BAYAR' || normalized === 'UNPAID') return '';
    if (normalized === 'CASH') return 'cash';
    if (normalized === 'TF') return 'tf';
    throw new Error('Pembayaran harus CASH, TF, atau kosong');
  }

  function rowHasParticipantData(row) {
    return !isBlank(row['Pembayaran']) ||
      !isBlank(row['Nama']) ||
      !isBlank(row['HC']) ||
      !isBlank(row['Bracket']);
  }

  function parseTournamentSize(rows) {
    var values = rows.map(function (row) { return row['Ukuran Tournament']; })
      .filter(function (value) { return !isBlank(value); });
    var size;

    if (!values.length) {
      throw new Error('Ukuran Tournament tidak ditemukan');
    }
    size = parseInteger(values[0], 'Ukuran Tournament', 2, 1024);
    if (values.some(function (value) {
      return parseInteger(value, 'Ukuran Tournament', 2, 1024) !== size;
    })) {
      throw new Error('Ukuran Tournament harus sama pada setiap baris');
    }
    return size;
  }

  function parseBoolean(value) {
    return value === true || value === 1 ||
      String(value == null ? '' : value).trim().toLowerCase() === 'true' ||
      String(value == null ? '' : value).trim() === '1';
  }

  function parseScore(value, label) {
    if (isBlank(value)) return '';
    var score = Number(value);
    if (!isFinite(score)) throw new Error(label + ' tidak valid');
    return score;
  }

  function parseBracketParticipant(row, prefix, size) {
    var id = row[prefix + ' ID'];
    var name = row[prefix + ' Nama'];
    var hc = row[prefix + ' HC'];
    var drawingNumber = row[prefix + ' Bracket'];
    var bye = parseBoolean(row[prefix + ' BYE']);
    var hasData = !isBlank(id) || !isBlank(name) || !isBlank(hc) || !isBlank(drawingNumber);

    if (bye) {
      return { id: null, name: 'BYE', hc: '', drawingNumber: parseOptionalDrawingNumber(drawingNumber, size, prefix + ' Bracket') };
    }
    if (!hasData) return null;
    if (isBlank(id)) throw new Error(prefix + ' ID tidak boleh kosong');
    return {
      id: String(id),
      name: String(name == null ? '' : name),
      hc: String(hc == null ? '' : hc),
      drawingNumber: parseOptionalDrawingNumber(drawingNumber, size, prefix + ' Bracket')
    };
  }

  function expectedMatchCounts(size) {
    var counts = [];
    var matches = Math.ceil(size / 2);
    while (matches > 0) {
      counts.push(matches);
      if (matches === 1) break;
      matches = Math.ceil(matches / 2);
    }
    return counts;
  }

  function validateBracketShape(bracketData, size) {
    var counts = expectedMatchCounts(size);
    if (!bracketData || Number(bracketData.size) !== size ||
        !Array.isArray(bracketData.rounds) ||
        bracketData.rounds.length !== counts.length ||
        counts.some(function (count, roundIndex) {
          var round = bracketData.rounds[roundIndex];
          return !Array.isArray(round) || round.length !== count ||
            round.some(function (match) {
              return !match || match.id == null || String(match.id).trim() === '';
            });
        })) {
      throw new Error('Bracket tidak tersedia atau strukturnya tidak lengkap');
    }
  }

  function parseBracket(XLSX, workbook, size) {
    var sheetNames = workbook && Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
    var rows;
    var counts;
    var rounds = [];
    var liveMatchIds = [];
    var seen = {};

    if (sheetNames.indexOf('Bracket') === -1) return null;
    rows = readSheetRows(XLSX, workbook, 'Bracket', BRACKET_COLUMNS);
    if (!rows.length) {
      throw new Error('Sheet Bracket tidak berisi data match');
    }
    rows = rows.map(function (row) {
      var roundIndex = parseInteger(row['Ronde'], 'Ronde', 0, 100);
      var matchIndex = parseInteger(row['Match'], 'Match', 0, 1024);
      return { row: row, roundIndex: roundIndex, matchIndex: matchIndex };
    }).sort(function (left, right) {
      return left.roundIndex - right.roundIndex || left.matchIndex - right.matchIndex;
    });
    counts = expectedMatchCounts(size);

    rows.forEach(function (entry) {
      var row = entry.row;
      var roundIndex = entry.roundIndex;
      var matchIndex = entry.matchIndex;
      var id = String(row['ID Match'] == null ? '' : row['ID Match']).trim();
      var p1;
      var p2;
      var winner;
      var match;
      var winnerId;
      var winnerIsBye;
      var status = String(row.Status == null ? '' : row.Status).trim().toLowerCase();
      var key = roundIndex + ':' + matchIndex;

      if (!counts[roundIndex] || matchIndex >= counts[roundIndex] || seen[key]) {
        throw new Error('Indeks Bracket tidak berurutan');
      }
      seen[key] = true;
      if (!id) throw new Error('ID Match tidak boleh kosong');
      p1 = parseBracketParticipant(row, 'P1', size);
      p2 = parseBracketParticipant(row, 'P2', size);
      winnerIsBye = parseBoolean(row['Pemenang BYE']);
      winnerId = row['Pemenang ID'];
      if (winnerIsBye) {
        winner = { id: null, name: 'BYE', hc: '', drawingNumber: parseOptionalDrawingNumber(row['Pemenang Bracket'], size, 'Pemenang Bracket') };
        if (!((p1 && p1.name === 'BYE') || (p2 && p2.name === 'BYE'))) {
          throw new Error('Pemenang tidak sesuai dengan peserta match');
        }
      } else if (!isBlank(winnerId) || !isBlank(row['Pemenang Nama']) ||
          !isBlank(row['Pemenang HC']) || !isBlank(row['Pemenang Bracket'])) {
        if (!p1 || !p2 || (String(p1.id) !== String(winnerId) && String(p2.id) !== String(winnerId))) {
          throw new Error('Pemenang tidak sesuai dengan peserta match');
        }
        winner = {
          id: String(winnerId),
          name: String(row['Pemenang Nama'] == null ? '' : row['Pemenang Nama']),
          hc: String(row['Pemenang HC'] == null ? '' : row['Pemenang HC']),
          drawingNumber: parseOptionalDrawingNumber(row['Pemenang Bracket'], size, 'Pemenang Bracket')
        };
      } else {
        winner = null;
      }

      if (['pending', 'live', 'done'].indexOf(status) === -1) {
        throw new Error('Status match tidak valid');
      }
      match = {
        id: id,
        p1: p1,
        p2: p2,
        score1: parseScore(row['Skor P1'], 'Skor P1'),
        score2: parseScore(row['Skor P2'], 'Skor P2'),
        winner: winner,
        status: status
      };
      if (!rounds[roundIndex]) rounds[roundIndex] = [];
      rounds[roundIndex][matchIndex] = match;
      if (parseBoolean(row.LIVE)) liveMatchIds.push(id);
    });

    if (rounds.length !== counts.length || counts.some(function (count, roundIndex) {
      var round = rounds[roundIndex];
      return !round || round.length !== count || round.some(function (match) { return !match; });
    })) {
      throw new Error('Indeks Bracket tidak berurutan');
    }

    return {
      bracket: { size: size, rounds: rounds },
      liveMatchIds: liveMatchIds
    };
  }

  function linkBracketParticipants(bracketData, participants) {
    if (!bracketData || !bracketData.bracket.rounds.length) return;

    var sources = [];
    var firstRound = bracketData.bracket.rounds[0];
    var idMap = [];

    firstRound.forEach(function (match) {
      [match.p1, match.p2].forEach(function (participant) {
        if (!participant || participant.id == null || participant.name === 'BYE') return;
        if (!sources.some(function (source) { return source.id === String(participant.id); })) {
          sources.push({
            id: String(participant.id),
            name: String(participant.name || '').trim(),
            hc: String(participant.hc || '').trim(),
            drawingNumber: participant.drawingNumber
          });
        }
      });
    });

    participants.forEach(function (participant) {
      var candidates = [];
      if (participant.drawingNumber != null) {
        candidates = sources.filter(function (source) {
          return Number(source.drawingNumber) === Number(participant.drawingNumber);
        });
      }
      if (!candidates.length && participant.name) {
        candidates = sources.filter(function (source) {
          return source.drawingNumber == null &&
            source.name === participant.name &&
            source.hc === participant.hc;
        });
      }
      if (candidates.length > 1) {
        throw new Error('Peserta Bracket tidak dapat dicocokkan secara unik');
      }
      if (candidates.length === 1) {
        if (idMap.some(function (entry) { return entry.sourceId === candidates[0].id; })) {
          throw new Error('Peserta Bracket tidak dapat dicocokkan secara unik');
        }
        idMap.push({ sourceId: candidates[0].id, participantId: participant.id });
      }
    });

    if (sources.some(function (source) {
      return !idMap.some(function (entry) { return entry.sourceId === source.id; });
    })) {
      throw new Error('Peserta Bracket tidak ditemukan pada sheet Peserta');
    }
    if (participants.some(function (participant) {
      return participant.drawingNumber != null &&
        !idMap.some(function (entry) { return entry.participantId === participant.id; });
    })) {
      throw new Error('Peserta dengan slot tidak ditemukan pada Bracket');
    }

    function remap(participant) {
      if (!participant || participant.id == null || participant.name === 'BYE') return;
      var mapping = idMap.find(function (entry) { return entry.sourceId === String(participant.id); });
      if (!mapping) throw new Error('Peserta Bracket tidak ditemukan pada sheet Peserta');
      participant.id = mapping.participantId;
    }

    bracketData.bracket.rounds.forEach(function (round) {
      round.forEach(function (match) {
        remap(match.p1);
        remap(match.p2);
        remap(match.winner);
      });
    });
  }

  function fillPendingByeSlots(bracketData, participants) {
    if (!bracketData || !bracketData.bracket || !bracketData.bracket.rounds.length) return;

    var firstRound = bracketData.bracket.rounds[0];
    var liveMatchIds = bracketData.liveMatchIds || [];

    participants.forEach(function (participant) {
      var slot = Number(participant && participant.drawingNumber);
      if (!isFinite(slot) || slot < 1) return;

      var matchIndex = Math.floor((slot - 1) / 2);
      var side = slot % 2 === 1 ? 'p1' : 'p2';
      var match = firstRound[matchIndex];
      var existing = match && match[side];

      if (!existing || existing.name !== 'BYE' ||
          Number(existing.drawingNumber) !== slot) return;

      if (match.status !== 'pending' || match.winner ||
          !isBlank(match.score1) || !isBlank(match.score2) ||
          liveMatchIds.indexOf(match.id) !== -1) {
        throw new Error('Peserta slot ' + slot + ' tidak sesuai dengan Bracket yang sudah memiliki progres');
      }

      var sourceId = 'transfer-slot-' + slot;
      while (bracketData.bracket.rounds.some(function (round) {
        return round.some(function (roundMatch) {
          return [roundMatch.p1, roundMatch.p2, roundMatch.winner].some(function (sideParticipant) {
            return sideParticipant && sideParticipant.id != null &&
              String(sideParticipant.id) === sourceId;
          });
        });
      })) {
        sourceId += '_';
      }
      match[side] = {
        id: sourceId,
        name: participant.name,
        hc: participant.hc,
        drawingNumber: participant.drawingNumber
      };
    });
  }

  function synchronizeAdvancement(bracketData) {
    if (!bracketData || !bracketData.bracket || !bracketData.bracket.rounds.length) return;

    var rounds = bracketData.bracket.rounds;
    var liveMatchIds = bracketData.liveMatchIds || [];

    rounds.slice(0, -1).forEach(function (round, roundIndex) {
      round.forEach(function (match, matchIndex) {
        var nextMatch = rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
        var side = matchIndex % 2 === 0 ? 'p1' : 'p2';
        var winner = match.winner;
        var current = nextMatch[side];
        var isDoubleBye = !winner && match.status === 'done' &&
          match.p1 && match.p1.name === 'BYE' &&
          match.p2 && match.p2.name === 'BYE';
        var expected = isDoubleBye
          ? { id: null, name: 'BYE', hc: '', drawingNumber: null }
          : winner;
        var same = current === expected ||
          (current && expected &&
            String(current.id) === String(expected.id) &&
            current.name === expected.name &&
            String(current.hc || '') === String(expected.hc || '') &&
            Number(current.drawingNumber) === Number(expected.drawingNumber)) ||
          (!current && !expected);

        if (same) return;
        if (nextMatch.status !== 'pending' || nextMatch.winner ||
            !isBlank(nextMatch.score1) || !isBlank(nextMatch.score2) ||
            liveMatchIds.indexOf(nextMatch.id) !== -1) {
          throw new Error('Peserta di ronde ' + (roundIndex + 2) + ' match ' +
            (Math.floor(matchIndex / 2) + 1) +
            ' tidak sesuai dengan hasil ronde sebelumnya');
        }
        nextMatch[side] = expected;
      });
    });
  }

  function parseWorkbook(XLSX, workbook, currentTournament) {
    if (!XLSX || !XLSX.utils || typeof XLSX.utils.sheet_to_json !== 'function') {
      throw new Error('Library Excel tidak tersedia');
    }
    if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.indexOf('Peserta') === -1) {
      throw new Error('Sheet Peserta tidak ditemukan');
    }

    var rows = readSheetRows(XLSX, workbook, 'Peserta', PARTICIPANT_COLUMNS);
    var size = parseTournamentSize(rows);
    var participants = [];

    rows.forEach(function (row) {
      var drawingNumber;
      var participant;
      if (!rowHasParticipantData(row)) return;
      drawingNumber = validateDrawingNumber(row['Bracket'], size, participants, null);
      participant = {
        id: 'row-' + (participants.length + 1),
        slot: participants.length + 1,
        name: String(row['Nama'] == null ? '' : row['Nama']).trim(),
        hc: String(row['HC'] == null ? '' : row['HC']).trim(),
        status: normalizePayment(row['Pembayaran']),
        drawingNumber: drawingNumber
      };
      participants.push(participant);
    });

    var tournament = Object.assign({}, currentTournament || {}, { size: size });
    var bracket = parseBracket(XLSX, workbook, size);
    fillPendingByeSlots(bracket, participants);
    linkBracketParticipants(bracket, participants);
    synchronizeAdvancement(bracket);
    return {
      participants: participants,
      tournament: tournament,
      bracket: bracket
    };
  }

  root.BilposExcelTransfer = {
    PARTICIPANT_COLUMNS: PARTICIPANT_COLUMNS,
    BRACKET_COLUMNS: BRACKET_COLUMNS,
    buildWorkbook: buildWorkbook,
    parseWorkbook: parseWorkbook,
    validateDrawingNumber: validateDrawingNumber
  };
}(window));
