var BilposStorage = {
  KEYS: {
    TOURNAMENT: 'bilpos_tournament',
    PARTICIPANTS: 'bilpos_participants',
    BRACKET: 'bilpos_bracket',
    SETTINGS: 'bilpos_settings'
  },

  DEFAULT_TOURNAMENT: {
    venue: 'Billiard Positif',
    size: 32,
    status: 'setup',
    currentRound: 0,
    createdAt: null
  },

  DEFAULT_SETTINGS: {
    zoom: 100,
    theme: 'dark'
  },

  _safeParse: function (value, fallback) {
    if (typeof value !== 'string') {
      return fallback;
    }

    try {
      var parsed = JSON.parse(value);
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  },

  _safeWrite: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('BilposStorage write failed:', e.message);
      return false;
    }
  },

  saveTournament: function (data) {
    var payload = Object.assign({}, this.DEFAULT_TOURNAMENT, data || {});
    this._safeWrite(this.KEYS.TOURNAMENT, payload);
    return payload;
  },

  loadTournament: function () {
    var stored = this._safeParse(localStorage.getItem(this.KEYS.TOURNAMENT), null);
    return Object.assign({}, this.DEFAULT_TOURNAMENT, stored || {});
  },

  saveParticipants: function (arr) {
    var participants = Array.isArray(arr) ? arr : [];
    this._safeWrite(this.KEYS.PARTICIPANTS, participants);
    return participants;
  },

  loadParticipants: function () {
    var stored = this._safeParse(localStorage.getItem(this.KEYS.PARTICIPANTS), []);
    return Array.isArray(stored) ? stored : [];
  },

  saveParticipant: function (p) {
    if (!p || p.id == null) return null;

    var participants = this.loadParticipants();
    var now = Date.now();
    var index = participants.findIndex(function (participant) {
      return participant && participant.id === p.id;
    });

    if (index >= 0) {
      participants[index] = Object.assign({}, p, {
        createdAt: participants[index].createdAt,
        updatedAt: now
      });
    } else {
      participants.push(Object.assign({}, p, {
        createdAt: now,
        updatedAt: now
      }));
    }

    this.saveParticipants(participants);
    return index >= 0 ? participants[index] : participants[participants.length - 1];
  },

  deleteParticipant: function (id) {
    var before = this.loadParticipants();
    var after = before.filter(function (participant) {
      return participant && participant.id !== id;
    });
    this.saveParticipants(after);
    return after.length < before.length;
  },

  findByPhone: function (phone) {
    var normalizedPhone = String(phone == null ? '' : phone).trim();
    return this.loadParticipants().filter(function (participant) {
      return String(participant && participant.phone != null ? participant.phone : '').trim() === normalizedPhone;
    });
  },

  getParticipantBySlot: function (slot) {
    var participants = this.loadParticipants();

    for (var i = 0; i < participants.length; i += 1) {
      if (participants[i] && Number(participants[i].drawingNumber) === Number(slot)) {
        return participants[i];
      }
    }

    return null;
  },

  saveBracket: function (data) {
    if (data == null) {
      localStorage.removeItem(this.KEYS.BRACKET);
      return null;
    }

    this._safeWrite(this.KEYS.BRACKET, data);
    return data;
  },

  replaceTournamentTransfer: function (tournament, participants, bracketData) {
    if (!tournament || typeof tournament !== 'object' ||
        !Array.isArray(participants) ||
        !bracketData || typeof bracketData !== 'object') {
      throw new Error('Data transfer tournament tidak valid');
    }

    var keys = [this.KEYS.TOURNAMENT, this.KEYS.PARTICIPANTS, this.KEYS.BRACKET];
    var values = [
      JSON.stringify(Object.assign({}, this.DEFAULT_TOURNAMENT, tournament)),
      JSON.stringify(participants),
      JSON.stringify(bracketData)
    ];
    var previousValues = keys.map(function (key) {
      return localStorage.getItem(key);
    });

    try {
      keys.forEach(function (key, index) {
        localStorage.setItem(key, values[index]);
      });
    } catch (writeError) {
      var rollbackErrors = [];
      keys.forEach(function (key, index) {
        try {
          if (previousValues[index] == null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, previousValues[index]);
          }
        } catch (rollbackError) {
          console.error('BilposStorage transfer rollback failed:', rollbackError.message);
          rollbackErrors.push(rollbackError.message);
        }
      });
      if (rollbackErrors.length) {
        throw new Error(
          'Gagal menyimpan data transfer: ' + writeError.message +
          '. Pemulihan data sebelumnya tidak lengkap: ' + rollbackErrors.join('; ')
        );
      }
      throw writeError;
    }
    return true;
  },

  loadBracket: function () {
    return this._safeParse(localStorage.getItem(this.KEYS.BRACKET), null);
  },

  clearBracket: function () {
    localStorage.removeItem(this.KEYS.BRACKET);
  },

  saveSettings: function (data) {
    var payload = Object.assign({}, this.DEFAULT_SETTINGS, data || {});
    this._safeWrite(this.KEYS.SETTINGS, payload);
    return payload;
  },

  loadSettings: function () {
    var stored = this._safeParse(localStorage.getItem(this.KEYS.SETTINGS), null);
    return Object.assign({}, this.DEFAULT_SETTINGS, stored || {});
  },

  clearAll: function () {
    var keys = Object.keys(this.KEYS);

    for (var i = 0; i < keys.length; i += 1) {
      localStorage.removeItem(this.KEYS[keys[i]]);
    }
  },

  exportAll: function () {
    return {
      tournament: this.loadTournament(),
      participants: this.loadParticipants(),
      bracket: this.loadBracket(),
      settings: this.loadSettings(),
      exportedAt: Date.now()
    };
  },

  importAll: function (data) {
    var hasRequiredShape = data &&
      typeof data === 'object' &&
      Object.prototype.hasOwnProperty.call(data, 'tournament') &&
      Object.prototype.hasOwnProperty.call(data, 'participants') &&
      Object.prototype.hasOwnProperty.call(data, 'bracket') &&
      Object.prototype.hasOwnProperty.call(data, 'settings');

    if (!hasRequiredShape) {
      return false;
    }

    this.saveTournament(data.tournament);
    this.saveParticipants(Array.isArray(data.participants) ? data.participants : []);
    this.saveBracket(data.bracket);
    this.saveSettings(data.settings);

    return true;
  }
};

if (typeof window !== 'undefined') {
  window.BilposStorage = BilposStorage;
}
