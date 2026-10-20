(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getElement(id) {
    if (typeof document === 'undefined' || !document.getElementById) {
      return null;
    }
    return document.getElementById(id);
  }

  function dispatchBracketActivated() {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      var event = typeof CustomEvent === 'function'
        ? new CustomEvent('bilpos:bracket-activated')
        : { type: 'bilpos:bracket-activated' };
      window.dispatchEvent(event);
    }
  }

  function dispatchParticipantsUpdated() {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      var event = typeof CustomEvent === 'function'
        ? new CustomEvent('bilpos:participants-updated')
        : { type: 'bilpos:participants-updated' };
      window.dispatchEvent(event);
    }
  }

  function getKnownHcValue(participant) {
    var hcValues = ['HC Pemula', 'HC 3SB', 'HC 3B', 'HC 3N', 'HC 3A', 'custom'];
    var hc = participant && participant.hc != null ? String(participant.hc) : '';
    var hcCustom = participant && participant.hcCustom != null ? String(participant.hcCustom) : '';
    if (hc === 'custom' || hcCustom) {
      return 'custom';
    }
    if (hcValues.indexOf(hc) !== -1) {
      return hc;
    }
    return hc ? 'custom' : '';
  }

  function getCustomHcValue(participant) {
    if (!participant) {
      return '';
    }
    if (participant.hcCustom != null && String(participant.hcCustom).trim()) {
      return String(participant.hcCustom).trim();
    }
    if (participant.hc && ['HC Pemula', 'HC 3SB', 'HC 3B', 'HC 3N', 'HC 3A', 'custom'].indexOf(String(participant.hc)) === -1) {
      return String(participant.hc);
    }
    return '';
  }

  function hasMeaningfulParticipantData(participant) {
    if (!participant) {
      return false;
    }
    return !!(
      String(participant.phone || '').trim() ||
      String(participant.name || '').trim() ||
      String(participant.hc || '').trim() ||
      String(participant.hcCustom || '').trim() ||
      String(participant.status || '').trim()
    );
  }

  function bracketHasResults(savedBracket) {
    var rounds = savedBracket && savedBracket.bracket && savedBracket.bracket.rounds;
    if (!Array.isArray(rounds)) return false;
    return rounds.some(function (round) {
      return Array.isArray(round) && round.some(function (match) {
        return match && (
          match.winner ||
          (match.score1 != null && String(match.score1) !== '') ||
          (match.score2 != null && String(match.score2) !== '')
        );
      });
    });
  }

  function sortByName(list, order) {
    return list.sort(function (left, right) {
      var leftName = String(left && left.name ? left.name : '').trim().toLowerCase();
      var rightName = String(right && right.name ? right.name : '').trim().toLowerCase();
      var leftPhone = String(left && left.phone ? left.phone : '').trim().toLowerCase();
      var rightPhone = String(right && right.phone ? right.phone : '').trim().toLowerCase();
      var direction = order === 'za' ? -1 : 1;

      if (!leftName && rightName) { return 1; }
      if (leftName && !rightName) { return -1; }
      if (leftName < rightName) { return -1 * direction; }
      if (leftName > rightName) { return 1 * direction; }
      if (leftPhone < rightPhone) { return -1 * direction; }
      if (leftPhone > rightPhone) { return 1 * direction; }
      return Number(left._sourceRow || 0) - Number(right._sourceRow || 0);
    });
  }

  // ── Bracket cascade-clear helpers (mirrors cascadeClearWinnerMut in BracketPage.jsx) ──

  // Clear scores/winner of a match and propagate removal of winner to next round
  function cascadeClearMatchInBracket(bracket, roundIdx, matchIdx) {
    if (roundIdx + 1 >= bracket.rounds.length) return;
    var match = bracket.rounds[roundIdx][matchIdx];
    if (!match) return;

    var prevWinner = match.winner;
    match.score1 = '';
    match.score2 = '';
    match.winner = null;
    match.status = 'pending';

    if (prevWinner) {
      var nextMatchIdx = Math.floor(matchIdx / 2);
      var slot = matchIdx % 2 === 0 ? 'p1' : 'p2';
      var nextMatch = bracket.rounds[roundIdx + 1] && bracket.rounds[roundIdx + 1][nextMatchIdx];
      if (nextMatch && nextMatch[slot]) {
        nextMatch[slot] = null;
        cascadeClearMatchInBracket(bracket, roundIdx + 1, nextMatchIdx);
      }
    }
  }

  // Update participant name/hc in every bracket match where they appear (live rename)
  function updateParticipantInBracket(participantId, updatedParticipant) {
    if (!window.BilposStorage) return;
    var saved = BilposStorage.loadBracket();
    if (!saved || !saved.bracket || !Array.isArray(saved.bracket.rounds)) return;
    var bracket = saved.bracket;
    var changed = false;

    bracket.rounds.forEach(function (round) {
      round.forEach(function (match) {
        if (match.p1 && match.p1.id != null && String(match.p1.id) === String(participantId)) {
          match.p1.name = updatedParticipant.name;
          match.p1.hc   = updatedParticipant.hc;
          changed = true;
        }
        if (match.p2 && match.p2.id != null && String(match.p2.id) === String(participantId)) {
          match.p2.name = updatedParticipant.name;
          match.p2.hc   = updatedParticipant.hc;
          changed = true;
        }
        // Also update winner field if this participant won the match
        if (match.winner && match.winner.id != null && String(match.winner.id) === String(participantId)) {
          match.winner.name = updatedParticipant.name;
          match.winner.hc   = updatedParticipant.hc;
          changed = true;
        }
      });
    });

    if (changed) {
      BilposStorage.saveBracket({ bracket: bracket, liveMatchId: saved.liveMatchId });
      dispatchBracketActivated();
    }
  }

  // Remove a participant from every match they appear in and cascade-clear results
  function clearParticipantFromBracket(participantId) {
    if (!window.BilposStorage) return;
    var saved = BilposStorage.loadBracket();
    if (!saved || !saved.bracket || !Array.isArray(saved.bracket.rounds)) return;
    var bracket = saved.bracket;
    var changed = false;

    bracket.rounds.forEach(function (round, roundIdx) {
      round.forEach(function (match, matchIdx) {
        var cleared = false;
        if (match.p1 && match.p1.id != null && String(match.p1.id) === String(participantId)) {
          match.p1 = null;
          cleared = true;
        }
        if (match.p2 && match.p2.id != null && String(match.p2.id) === String(participantId)) {
          match.p2 = null;
          cleared = true;
        }
        if (cleared) {
          changed = true;
          cascadeClearMatchInBracket(bracket, roundIdx, matchIdx);
        }
      });
    });

    if (changed) {
      BilposStorage.saveBracket({ bracket: bracket, liveMatchId: saved.liveMatchId });
      dispatchBracketActivated();
    }
  }

  // Clear ALL real-participant references from every bracket match (used for delete-all)
  function clearAllParticipantsFromBracket() {
    if (!window.BilposStorage) return;
    var saved = BilposStorage.loadBracket();
    if (!saved || !saved.bracket || !Array.isArray(saved.bracket.rounds)) return;
    var bracket = saved.bracket;

    bracket.rounds.forEach(function (round) {
      round.forEach(function (match) {
        if (match.p1 && match.p1.id != null) match.p1 = null;
        if (match.p2 && match.p2.id != null) match.p2 = null;
        match.score1 = '';
        match.score2 = '';
        match.winner = null;
        match.status = 'pending';
      });
    });

    BilposStorage.saveBracket({ bracket: bracket, liveMatchId: saved.liveMatchId });
    dispatchBracketActivated();
  }

  var BilposApp = {
    participants: [],
    settings: null,
    sortOrder: 'default',
    _eventsWired: false,

    init: function () {
      if (typeof BilposStorage === 'undefined') {
        return;
      }
      this.tournament = BilposStorage.loadTournament();
      this.participants = BilposStorage.loadParticipants();
      this.settings = BilposStorage.loadSettings();
      this.sortOrder = 'default';
      this.renderTournamentSetup();
      this.renderParticipantTable();
      this.renderStats();
      this.wireEvents();
      document.querySelectorAll('.bilpos-section').forEach(function (s) {
        s.style.display = '';
        if (s.classList) s.classList.add('active');
      });
      BilposUI.updateHeader(this.tournament);
      try {
        var navDefault = document.querySelector('.sidebar-nav-item[data-section="dashboard"]');
        if (navDefault) navDefault.classList.add('active');
      } catch (err) {}
    },

    renderTournamentSetup: function () {
      var sizeInput = getElement('input-size');
      var tournament = this.tournament || BilposStorage.loadTournament();
      var size = parseInt(tournament.size, 10) || 32;

      var feeInput = getElement('input-fee');
      if (feeInput) {
        feeInput.value = typeof tournament.fee !== 'undefined' && tournament.fee !== null ? tournament.fee : '';
      }
      if (sizeInput) {
        sizeInput.value = String(size);
      }
    },

    getParticipantsForTable: function () {
      var size = parseInt(this.tournament && this.tournament.size, 10) || 32;
      var slotMap = {};
      var slotless = [];
      var ordered = [];
      var participants = Array.isArray(this.participants) ? this.participants.slice() : [];
      var i;

      for (i = 0; i < participants.length; i += 1) {
        if (participants[i] && Number(participants[i].slot) >= 1) {
          slotMap[Number(participants[i].slot)] = participants[i];
        } else {
          slotless.push(participants[i]);
        }
      }
      for (i = 1; i <= size; i += 1) {
        ordered.push(slotMap[i] || slotless[i - 1] || null);
      }
      if (this.sortOrder === 'az' || this.sortOrder === 'za') {
        ordered = sortByName(ordered.slice(), this.sortOrder);
      }
      return ordered;
    },

    renderParticipantTable: function () {
      var tbody = getElement('participant-tbody');
      var size = parseInt(this.tournament && this.tournament.size, 10) || 32;
      var rows = [];
      var participants = this.getParticipantsForTable();
      var i;

      if (!tbody) { return; }

      for (i = 1; i <= size; i += 1) {
        var participant = participants[i - 1] || null;
        var name = participant && participant.name ? participant.name : '';
        var hcValue = getKnownHcValue(participant);
        var hcCustom = getCustomHcValue(participant);
        var status = participant && participant.status ? participant.status : '';
        var rowClass = status === 'cash' ? 'row-paid-cash' : (status === 'tf' ? 'row-paid-tf' : '');
        var cashActive = status === 'cash' ? 'active' : '';
        var tfActive = status === 'tf' ? 'active' : '';
        var customVisible = hcValue === 'custom' ? 'visible' : '';

        rows.push(
          '<tr id="row-' + i + '" data-row="' + i + '" data-current-status="' + escapeHtml(status) + '" class="' + rowClass + '">' +
            '<td class="row-number">' + i + '</td>' +
            '<td>' +
              '<div class="d-flex gap-1">' +
                '<button class="status-btn cash ' + cashActive + '" data-row="' + i + '" data-status="cash">' +
                  '<i class="fas fa-money-bill"></i> CASH' +
                '</button>' +
                '<button class="status-btn tf ' + tfActive + '" data-row="' + i + '" data-status="tf">' +
                  '<i class="fas fa-exchange-alt"></i> TF' +
                '</button>' +
              '</div>' +
            '</td>' +
            '<td>' +
              '<input type="text" class="table-input name-input" data-row="' + i + '" placeholder="Nama peserta..." value="' + escapeHtml(name) + '" maxlength="40"/>' +
            '</td>' +
            '<td>' +
              '<select class="table-select hc-select" data-row="' + i + '">' +
                '<option value="">— HC —</option>' +
                '<option value="HC Pemula"' + (hcValue === 'HC Pemula' ? ' selected' : '') + '>HC Pemula</option>' +
                '<option value="HC 3SB"' + (hcValue === 'HC 3SB' ? ' selected' : '') + '>HC 3SB</option>' +
                '<option value="HC 3B"' + (hcValue === 'HC 3B' ? ' selected' : '') + '>HC 3B</option>' +
                '<option value="HC 3N"' + (hcValue === 'HC 3N' ? ' selected' : '') + '>HC 3N</option>' +
                '<option value="HC 3A"' + (hcValue === 'HC 3A' ? ' selected' : '') + '>HC 3A</option>' +
                '<option value="custom"' + (hcValue === 'custom' ? ' selected' : '') + '>Custom</option>' +
              '</select>' +
              '<input type="text" class="hc-custom-input ' + customVisible + '" data-row="' + i + '" placeholder="Tulis HC..." value="' + escapeHtml(hcCustom) + '" maxlength="20"/>' +
            '</td>' +
            '<td>' +
              '<input type="number" class="table-input bracket-input" data-row="' + i + '" min="1" max="' + size + '" placeholder="-" value="' + escapeHtml(participant && participant.drawingNumber != null ? participant.drawingNumber : '') + '"/>' +
            '</td>' +
            '<td>' +
              '<button class="btn-delete-row btn-export" data-row="' + i + '"><i class="fas fa-trash"></i></button>' +
            '</td>' +
          '</tr>'
        );
      }

      tbody.innerHTML = rows.join('');

      for (i = 1; i <= size; i += 1) {
        var customInput = document.querySelector('.hc-custom-input[data-row="' + i + '"]');
        if (customInput && !customInput.classList.contains('visible')) {
          customInput.style.display = 'none';
        }
      }
    },

    renderStats: function () {
      var fee = parseFloat(this.tournament && this.tournament.fee) || 0;
      var participants = Array.isArray(this.participants) ? this.participants : [];
      var totalParticipants = participants.length;
      var cashCount = participants.filter(function (p) { return p && p.status === 'cash'; }).length;
      var tfCount = participants.filter(function (p) { return p && p.status === 'tf'; }).length;
      var bayarCashAmount = cashCount * fee;
      var transferAmount = tfCount * fee;
      var totalBayar = bayarCashAmount + transferAmount;
      var belumBayar = (totalParticipants * fee) - totalBayar;

      function setElText(id, value) {
        var el = getElement(id);
        if (!el) return;
        try { el.textContent = Number(value).toLocaleString(); } catch (e) { el.textContent = String(value); }
      }

      setElText('stat-bayar-cash', bayarCashAmount);
      setElText('stat-transfer', transferAmount);
      setElText('stat-total-bayar', totalBayar);
      setElText('stat-belum-bayar', belumBayar < 0 ? 0 : belumBayar);
      BilposUI.updateHeader(this.tournament);
    },

    wireEvents: function () {
      var self = this;

      if (this._eventsWired) { return; }
      this._eventsWired = true;

      document.querySelectorAll('.sidebar-nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var section = item.dataset.section;
          document.querySelectorAll('.sidebar-nav-item').forEach(function (it) { it.classList.remove('active'); });
          item.classList.add('active');
          var el = document.getElementById('section-' + section);
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (section === 'statistics') self.renderStats();
          if (section === 'bracket') dispatchBracketActivated();
        });
      });

      var feeInputEl = getElement('input-fee');
      if (feeInputEl) {
        feeInputEl.addEventListener('input', function (e) {
          var fee = parseFloat(e.target.value) || 0;
          self.tournament.fee = fee;
          BilposStorage.saveTournament(self.tournament);
          self.renderStats();
        });
      }

      var inputSize = getElement('input-size');
      if (inputSize) {
        inputSize.addEventListener('change', function (e) {
          var size = parseInt(e.target.value, 10);
          self.tournament.size = size;
          BilposStorage.saveTournament(self.tournament);
          dispatchBracketActivated();
          self.renderParticipantTable();
          self.renderStats();
        });
      }

      var participantTbody = getElement('participant-tbody');
      if (participantTbody) {
        participantTbody.addEventListener('click', function (e) {
          var btn = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.status-btn') : null;
          if (!btn) return;
          var rowIndex = parseInt(btn.dataset.row, 10);
          var status = btn.dataset.status;
          var row = getElement('row-' + rowIndex);
          var currentStatus = row ? row.dataset.currentStatus : '';
          var newStatus = currentStatus === status ? '' : status;

          if (row) {
            row.classList.remove('row-paid-cash', 'row-paid-tf');
            row.querySelectorAll('.status-btn').forEach(function (button) {
              button.classList.remove('active');
            });
          }
          if (newStatus === 'cash') {
            if (row) row.classList.add('row-paid-cash');
            btn.classList.add('active');
          } else if (newStatus === 'tf') {
            if (row) row.classList.add('row-paid-tf');
            btn.classList.add('active');
          }
          if (row) row.dataset.currentStatus = newStatus;

          var participant = self.getParticipantForRow(rowIndex);
          if (participant && participant.id) {
            participant.status = newStatus;
            BilposStorage.saveParticipant(participant);
            self.participants = BilposStorage.loadParticipants();
            self.renderStats();
          }
        });

        participantTbody.addEventListener('change', function (e) {
          if (e.target.classList.contains('bracket-input')) {
            self.saveDrawingNumber(e.target);
            return;
          }
          if (!e.target.classList.contains('hc-select')) return;
          var rowIndex = e.target.dataset.row;
          var customInput = document.querySelector('.hc-custom-input[data-row="' + rowIndex + '"]');
          if (customInput) {
            if (e.target.value === 'custom') {
              customInput.classList.add('visible');
              customInput.style.display = 'block';
            } else {
              customInput.classList.remove('visible');
              customInput.style.display = 'none';
            }
          }
        });
      }

      var participantSearch = getElement('participant-search');
      if (participantSearch) {
        participantSearch.addEventListener('input', function (e) {
          var query = e.target.value.toLowerCase();
          document.querySelectorAll('#participant-tbody tr').forEach(function (row) {
            var name = row.querySelector('.name-input') && row.querySelector('.name-input').value.toLowerCase() || '';
            var visible = !query || name.indexOf(query) !== -1;
            row.style.display = visible ? '' : 'none';
          });
        });
      }

      var participantTbodyEl = getElement('participant-tbody');
      if (participantTbodyEl) {
        participantTbodyEl.addEventListener('input', function (e) {
          var t = e.target;
          if (t.matches('.name-input') || t.matches('.hc-custom-input') || t.matches('.hc-select')) {
            var rowIndex = parseInt(t.dataset.row, 10);
            setTimeout(function () { self.saveParticipantRow(rowIndex); }, 140);
          }
        });

        participantTbodyEl.addEventListener('click', function (e) {
          var del = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.btn-delete-row') : null;
          if (del) {
            var rowIndex = parseInt(del.dataset.row, 10);
            if (confirm('Hapus peserta ini?')) {
              clearParticipantFromBracket('row-' + rowIndex);
              BilposStorage.deleteParticipant('row-' + rowIndex);
              self.participants = BilposStorage.loadParticipants();
              self.renderParticipantTable();
              self.renderStats();
              dispatchParticipantsUpdated();
              if (typeof BilposUI !== 'undefined') BilposUI.showToast('Peserta dihapus', 'success');
            }
          }
        });
      }

      var sortAzBtn = getElement('btn-sort-az');
      if (sortAzBtn) {
        sortAzBtn.addEventListener('click', function () { self.sortParticipants('az'); });
      }

      var sortZaBtn = getElement('btn-sort-za');
      if (sortZaBtn) {
        sortZaBtn.addEventListener('click', function () { self.sortParticipants('za'); });
      }

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function (evt) {
          try {
            var key = evt.key;
            if (!key) return;
            var interesting = ['bilpos_participants', 'bilpos_tournament', 'bilpos_settings'];
            if (interesting.indexOf(key) === -1) return;
            try { self.tournament = BilposStorage.loadTournament(); } catch (e) {}
            try { self.participants = BilposStorage.loadParticipants(); } catch (e) {}
            try { self.settings = BilposStorage.loadSettings(); } catch (e) {}
            try { self.renderParticipantTable(); self.renderStats(); } catch (e) {}
          } catch (err) {}
        });
      }

      var resetAllBtn = getElement('btn-reset-all');
      if (resetAllBtn) {
        resetAllBtn.addEventListener('click', function () {
          if (confirm('RESET SEMUA DATA? Tindakan ini tidak dapat dibatalkan!')) {
            BilposStorage.clearAll();
            location.reload();
          }
        });
      }

      var deleteAllBtn = getElement('btn-delete-all');
      if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', function () {
          if (confirm('Hapus semua peserta? Tindakan ini akan mengosongkan daftar peserta.')) {
            BilposStorage.saveParticipants([]);
            self.participants = [];
            self.renderParticipantTable();
            self.renderStats();
            dispatchParticipantsUpdated();
            clearAllParticipantsFromBracket();
            if (typeof BilposUI !== 'undefined') BilposUI.showToast('Semua peserta dihapus', 'success');
          }
        });
      }

      var exportExcelBtn = getElement('btn-export-excel');
      if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', function () { self.exportExcel(); });
      }

      var importExcelInput = getElement('import-excel-input');
      if (importExcelInput) {
        importExcelInput.addEventListener('change', function (e) {
          try {
            self.importExcel(e.target.files[0]);
          } finally {
            e.target.value = '';
          }
        });
      }

      var importExcelButton = getElement('btn-import-excel');
      if (importExcelButton && importExcelInput) {
        importExcelButton.addEventListener('click', function () {
          importExcelInput.click();
        });
      }

      var exportJsonBtn = getElement('btn-export-json');
      if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', function () { self.exportJSON(); });
      }

      var importJsonInput = getElement('import-json-input');
      if (importJsonInput) {
        importJsonInput.addEventListener('change', function (e) { self.importJSON(e.target.files[0]); });
      }

      // Preview bracket button
      var previewBtn = getElement('btn-preview-bracket');
      if (previewBtn) {
        previewBtn.addEventListener('click', function () {
          var saved      = window.BilposStorage ? BilposStorage.loadBracket()    : null;
          var tournament = window.BilposStorage ? BilposStorage.loadTournament() : {};
          var payloadObj = {
            bracket:      saved && saved.bracket      ? saved.bracket      : null,
            liveMatchIds: saved && saved.liveMatchIds ? saved.liveMatchIds : [],
            tournament:   tournament
          };

          if (window.BilposFirebase) {
            BilposFirebase.openPreview(payloadObj);
          } else {
            // Fallback: hash-based URL
            var compressed = window.LZString
              ? LZString.compressToEncodedURIComponent(JSON.stringify(payloadObj))
              : encodeURIComponent(JSON.stringify(payloadObj));
            window.open('preview.html#' + compressed, '_blank');
          }
        });
      }
    },

    getParticipantForRow: function (rowIndex) {
      var participantId = 'row-' + rowIndex;
      var found = (this.participants || []).find(function (participant) {
        return participant && participant.id === participantId;
      });
      return found || {
        id: participantId,
        slot: parseInt(rowIndex, 10),
        drawingNumber: null,
        phone: '',
        name: '',
        hc: '',
        hcCustom: '',
        status: ''
      };
    },

    collectTableRows: function () {
      var size = parseInt(this.tournament && this.tournament.size, 10) || 32;
      var rows = [];
      var i;
      for (i = 1; i <= size; i += 1) {
        var name = document.querySelector('.name-input[data-row="' + i + '"]');
        var hcSelectEl = document.querySelector('.hc-select[data-row="' + i + '"]');
        var hcCustomEl = document.querySelector('.hc-custom-input[data-row="' + i + '"]');
        var rowEl = getElement('row-' + i);
        var hcValue = hcSelectEl ? hcSelectEl.value : '';
        var hcCustom = hcCustomEl ? hcCustomEl.value.trim() : '';
        var hc = hcValue === 'custom' ? hcCustom : hcValue;
        var existingParticipant = (this.participants || []).find(function (p) { return p && p.id === 'row-' + i; });
        var phoneValue = existingParticipant ? (existingParticipant.phone || '') : '';
        rows.push({
          id: 'row-' + i,
          slot: i,
          phone: phoneValue,
          name: name ? name.value.trim() : '',
          hc: hc,
          hcCustom: hcValue === 'custom' ? hcCustom : '',
          drawingNumber: existingParticipant && existingParticipant.drawingNumber != null
            ? existingParticipant.drawingNumber
            : null,
          status: rowEl ? rowEl.dataset.currentStatus || '' : '',
          _sourceRow: i
        });
      }
      return rows;
    },

    sortParticipants: function (order) {
      var rows = this.collectTableRows();
      var meaningfulRows = rows.filter(hasMeaningfulParticipantData);
      var sortedRows = sortByName(meaningfulRows.slice(), order);
      var savedParticipants = [];
      var i;
      this.sortOrder = order;
      for (i = 0; i < sortedRows.length; i += 1) {
        savedParticipants.push({
          id: 'row-' + (i + 1),
          slot: i + 1,
          phone: sortedRows[i].phone,
          name: sortedRows[i].name,
          hc: sortedRows[i].hc,
          hcCustom: sortedRows[i].hcCustom,
          drawingNumber: sortedRows[i].drawingNumber,
          status: sortedRows[i].status
        });
      }
      BilposStorage.saveParticipants(savedParticipants);
      this.participants = BilposStorage.loadParticipants();
      this.renderParticipantTable();
      this.renderStats();
    },

    saveDrawingNumber: function (input) {
      var rowIndex = parseInt(input.dataset.row, 10);
      var participantId = 'row-' + rowIndex;
      var participants = Array.isArray(this.participants) ? this.participants : [];
      var existingParticipant = participants.find(function (participant) {
        return participant && String(participant.id) === participantId;
      });
      var previousNumber = existingParticipant && existingParticipant.drawingNumber != null
        ? Number(existingParticipant.drawingNumber)
        : null;
      var nextNumber;
      var savedBracket;
      var nextParticipants;
      var updatedParticipant;
      var size = parseInt(this.tournament && this.tournament.size, 10) || 32;

      if (!existingParticipant) {
        BilposUI.showToast('Isi data peserta sebelum menentukan nomor Bracket', 'danger');
        input.value = '';
        return;
      }

      try {
        nextNumber = BilposExcelTransfer.validateDrawingNumber(
          input.value,
          size,
          participants,
          participantId
        );
      } catch (error) {
        BilposUI.showToast(error.message || 'Nomor Bracket tidak valid', 'danger');
        input.value = previousNumber == null ? '' : String(previousNumber);
        return;
      }

      if (nextNumber === previousNumber) return;
      savedBracket = BilposStorage.loadBracket();
      if (bracketHasResults(savedBracket) &&
          !confirm('Mengubah nomor Bracket akan mengatur ulang hasil pertandingan. Lanjutkan?')) {
        input.value = previousNumber == null ? '' : String(previousNumber);
        return;
      }

      updatedParticipant = Object.assign({}, existingParticipant, {
        drawingNumber: nextNumber
      });
      nextParticipants = participants.map(function (participant) {
        return participant && String(participant.id) === participantId
          ? updatedParticipant
          : participant;
      });
      BilposStorage.saveParticipants(nextParticipants);
      this.participants = BilposStorage.loadParticipants();
      BilposStorage.saveBracket({
        bracket: BilposTournament.generateBracket(size, this.participants),
        liveMatchIds: []
      });
      this.renderParticipantTable();
      this.renderStats();
      dispatchParticipantsUpdated();
      dispatchBracketActivated();
    },

    exportJSON: function () {
      var data = BilposStorage.exportAll();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bilpos-tournament-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      BilposUI.showToast('Data berhasil diekspor!', 'success');
    },

    importJSON: function (file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          BilposStorage.importAll(data);
          BilposUI.showToast('Data berhasil diimpor!', 'success');
          setTimeout(function () { location.reload(); }, 1000);
        } catch (err) {
          BilposUI.showToast('File JSON tidak valid!', 'danger');
        }
      };
      reader.readAsText(file);
    },

    exportExcel: function () {
      if (typeof XLSX === 'undefined' || typeof BilposExcelTransfer === 'undefined') {
        BilposUI.showToast('Library Excel tidak tersedia', 'danger');
        return;
      }
      try {
        var participants = BilposStorage.loadParticipants();
        var tournament = BilposStorage.loadTournament();
        var savedBracket = BilposStorage.loadBracket();
        if (!savedBracket || !savedBracket.bracket) {
          savedBracket = {
            bracket: BilposTournament.generateBracket(tournament.size, participants),
            liveMatchIds: []
          };
        }
        var workbook = BilposExcelTransfer.buildWorkbook(
          XLSX,
          participants,
          tournament,
          savedBracket
        );
        XLSX.writeFile(workbook, 'rack-n-roll-peserta-' + new Date().toISOString().slice(0, 10) + '.xlsx');
        BilposUI.showToast('Excel berhasil diekspor!', 'success');
      } catch (error) {
        BilposUI.showToast('Gagal mengekspor Excel: ' + error.message, 'danger');
      }
    },

    importExcel: function (file) {
      if (!file) return;
      if (typeof XLSX === 'undefined' || typeof BilposExcelTransfer === 'undefined') {
        BilposUI.showToast('Library Excel tidak tersedia', 'danger');
        return;
      }
      if (typeof FileReader === 'undefined') {
        BilposUI.showToast('Pembaca file tidak tersedia', 'danger');
        return;
      }

      var self = this;
      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var workbook = XLSX.read(event.target.result, { type: 'array' });
          var parsed = BilposExcelTransfer.parseWorkbook(
            XLSX,
            workbook,
            BilposStorage.loadTournament()
          );
          var bracketData = parsed.bracket || {
            bracket: BilposTournament.generateBracket(parsed.tournament.size, parsed.participants),
            liveMatchIds: []
          };

          BilposStorage.replaceTournamentTransfer(
            parsed.tournament,
            parsed.participants,
            bracketData
          );
          self.tournament = parsed.tournament;
          self.participants = parsed.participants;
          self.renderTournamentSetup();
          self.renderParticipantTable();
          self.renderStats();
          dispatchParticipantsUpdated();
          dispatchBracketActivated();
          BilposUI.showToast('Excel berhasil diimpor!', 'success');
        } catch (error) {
          BilposUI.showToast('Gagal mengimpor Excel: ' + error.message, 'danger');
        }
      };
      reader.onerror = function () {
        BilposUI.showToast('Gagal membaca file Excel', 'danger');
      };
      try {
        reader.readAsArrayBuffer(file);
      } catch (error) {
        BilposUI.showToast('Gagal membaca file Excel: ' + error.message, 'danger');
      }
    },

    saveParticipantRow: function (rowIndex) {
      rowIndex = parseInt(rowIndex, 10);
      var name = document.querySelector('.name-input[data-row="' + rowIndex + '"]') && document.querySelector('.name-input[data-row="' + rowIndex + '"]').value.trim() || '';
      var hcSelectEl = document.querySelector('.hc-select[data-row="' + rowIndex + '"]');
      var hcCustomEl = document.querySelector('.hc-custom-input[data-row="' + rowIndex + '"]');
      var hcValue = hcSelectEl && hcSelectEl.value || '';
      var hcCustom = hcCustomEl && hcCustomEl.value.trim() || '';
      var hc = hcValue === 'custom' ? hcCustom : hcValue;
      var row = getElement('row-' + rowIndex);
      var status = row && row.dataset.currentStatus || '';
      var existingParticipant = (this.participants || []).find(function (p) { return p && p.id === 'row-' + rowIndex; });
      var phone = existingParticipant ? (existingParticipant.phone || '') : '';
      var oldName = existingParticipant ? (existingParticipant.name || '') : '';

      var participant = {
        id: 'row-' + rowIndex,
        slot: rowIndex,
        phone: phone,
        name: name,
        hc: hc,
        hcCustom: hcValue === 'custom' ? hcCustom : '',
        drawingNumber: existingParticipant && existingParticipant.drawingNumber != null
          ? existingParticipant.drawingNumber
          : null,
        status: status
      };

      BilposStorage.saveParticipant(participant);
      this.participants = BilposStorage.loadParticipants();
      this.renderStats();
      dispatchParticipantsUpdated();

      // If name or HC changed, update in-place inside bracket (no clearing)
      if (existingParticipant && (name !== oldName || hc !== (existingParticipant.hc || ''))) {
        updateParticipantInBracket('row-' + rowIndex, participant);
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    BilposApp.init();
  });

  if (typeof window !== 'undefined') {
    window.BilposApp = BilposApp;
  }
})();
