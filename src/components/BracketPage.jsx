import React, { useState, useEffect, useCallback, useRef } from 'react';
import BracketView from './BracketView';
import { resolveWinner } from './bracketUtils';

// Mutating cascade-clear for use on already-deepCloned brackets.
// Clears the slot populated by match (roundIdx, matchIdx) and recurses
// if the parent match also had a determined winner.
function cascadeClearWinnerMut(bracket, roundIdx, matchIdx) {
  var nextRoundIdx = roundIdx + 1;
  if (nextRoundIdx >= bracket.rounds.length) return;

  var nextMatchIdx = Math.floor(matchIdx / 2);
  var slot = matchIdx % 2 === 0 ? 'p1' : 'p2';
  var parentMatch = bracket.rounds[nextRoundIdx][nextMatchIdx];

  if (!parentMatch || !parentMatch[slot]) return;

  var hadWinner = parentMatch.winner;
  parentMatch[slot]    = null;
  parentMatch.score1   = '';
  parentMatch.score2   = '';
  parentMatch.winner   = null;
  parentMatch.status   = 'pending';

  if (hadWinner) {
    cascadeClearWinnerMut(bracket, nextRoundIdx, nextMatchIdx);
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function syncParticipantDrawingNumbers(participants, bracket) {
  var drawingNumbers = new Map();
  var firstRound = bracket.rounds[0] || [];

  firstRound.forEach(function(match, matchIdx) {
    [match && match.p1, match && match.p2].forEach(function(participant, slotIdx) {
      if (!participant || participant.id == null) return;
      var participantId = String(participant.id);
      if (!drawingNumbers.has(participantId)) {
        drawingNumbers.set(participantId, matchIdx * 2 + slotIdx + 1);
      }
    });
  });

  var changed = false;
  var syncedParticipants = participants.map(function(participant) {
    if (!participant || participant.id == null) return participant;
    var drawingNumber = drawingNumbers.has(String(participant.id))
      ? drawingNumbers.get(String(participant.id))
      : null;
    if (participant.drawingNumber === drawingNumber) return participant;
    changed = true;
    return Object.assign({}, participant, { drawingNumber: drawingNumber });
  });
  return changed ? syncedParticipants : participants;
}

function dispatchParticipantsUpdated() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  var event = typeof CustomEvent === 'function'
    ? new CustomEvent('bilpos:participants-updated')
    : { type: 'bilpos:participants-updated' };
  window.dispatchEvent(event);
}

function loadInitialState() {
  var storage      = window.BilposStorage;
  var tournament_  = (storage && storage.loadTournament())  || { size: 32 };
  var participants = (storage && storage.loadParticipants()) || [];
  var saved        = storage && storage.loadBracket();

  var bracket;
  var liveMatchIds = new Set();
  var size = parseInt(tournament_.size, 10) || 32;

  if (saved && saved.bracket && saved.bracket.size === size) {
    var round0 = saved.bracket.rounds && saved.bracket.rounds[0];
    var allEmpty = !round0 || round0.every(function(m) {
      return (!m.p1 || !m.p1.id) && (!m.p2 || !m.p2.id);
    });
    if (!allEmpty) {
      bracket = saved.bracket;
      // Backward-compat: support old single liveMatchId and new liveMatchIds array
      if (Array.isArray(saved.liveMatchIds)) {
        liveMatchIds = new Set(saved.liveMatchIds);
      } else if (saved.liveMatchId) {
        liveMatchIds = new Set([saved.liveMatchId]);
      }
    }
  }

  if (!bracket) {
    bracket = window.BilposTournament
      ? window.BilposTournament.generateBracket(size, [])
      : { rounds: [], size: size, generatedAt: Date.now() };
  }

  return { bracket: bracket, liveMatchIds: liveMatchIds, participants: participants };
}

export default function BracketPage() {
  var [state, setState] = useState(loadInitialState);
  var participantUpdatePending = useRef(false);

  // Re-read storage when participants/tournament storage keys change (cross-tab)
  useEffect(function() {
    function onStorage(e) {
      if (e.key === 'bilpos_participants' || e.key === 'bilpos_tournament') {
        setState(loadInitialState());
      }
    }
    window.addEventListener('storage', onStorage);
    return function() { window.removeEventListener('storage', onStorage); };
  }, []);

  // Re-read participants when app.js dispatches bilpos:participants-updated (same tab)
  useEffect(function() {
    function onParticipantsUpdated() {
      var storage = window.BilposStorage;
      var participants = (storage && storage.loadParticipants()) || [];
      setState(function(prev) {
        return { bracket: prev.bracket, liveMatchIds: prev.liveMatchIds, participants: participants };
      });
    }
    window.addEventListener('bilpos:participants-updated', onParticipantsUpdated);
    return function() { window.removeEventListener('bilpos:participants-updated', onParticipantsUpdated); };
  }, []);

  useEffect(function() {
    if (!participantUpdatePending.current) return;
    participantUpdatePending.current = false;
    dispatchParticipantsUpdated();
  }, [state.participants]);

  // Re-read storage when bracket nav tab is clicked (bilpos:bracket-activated event)
  useEffect(function() {
    function onActivated() { setState(loadInitialState()); }
    window.addEventListener('bilpos:bracket-activated', onActivated);
    return function() { window.removeEventListener('bilpos:bracket-activated', onActivated); };
  }, []);

  var saveState = useCallback(function(newBracket, newLiveMatchIds) {
    if (window.BilposStorage) {
      window.BilposStorage.saveBracket({
        bracket:      newBracket,
        liveMatchIds: Array.from(newLiveMatchIds),
      });
    }
  }, []);

  var handleScoreChange = useCallback(function(roundIdx, matchIdx, slot, rawValue) {
    setState(function(prev) {
      var newBracket  = deepClone(prev.bracket);
      var scoreKey    = slot === 1 ? 'score1' : 'score2';
      var value       = rawValue === '' ? '' : Number(rawValue);
      var match       = newBracket.rounds[roundIdx][matchIdx];
      var prevWinner  = match.winner;

      match[scoreKey] = value;

      var newWinner = resolveWinner(match);
      match.winner  = newWinner;
      match.status  = newWinner ? 'done' : 'pending';

      var winnerChanged = (newWinner && prevWinner && String(newWinner.id) !== String(prevWinner.id))
                       || (newWinner && !prevWinner)
                       || (!newWinner && prevWinner);

      if (winnerChanged) {
        // Clear any previously-advanced participant first
        if (prevWinner) {
          cascadeClearWinnerMut(newBracket, roundIdx, matchIdx);
        }
        // Advance the new winner (or nothing if newWinner is null)
        if (newWinner && window.BilposTournament) {
          // Enrich winner with full participant data (preserves hcCustom)
          var fullWinner = prev.participants.find(function(p) { return String(p.id) === String(newWinner.id); }) || newWinner;
          window.BilposTournament.advanceWinner(newBracket, roundIdx, matchIdx, fullWinner);
        }
      }

      // Auto-remove match from liveMatchIds when winner is determined
      var newLiveMatchIds = new Set(prev.liveMatchIds);
      if (newWinner) newLiveMatchIds.delete(match.id);

      saveState(newBracket, newLiveMatchIds);
      return { bracket: newBracket, liveMatchIds: newLiveMatchIds, participants: prev.participants };
    });
  }, [saveState]);

  var handleSelectParticipant = useCallback(function(roundIdx, matchIdx, slot, participantId) {
    if (roundIdx !== 0) return;
    var BYE_VALUE = '__bye__';
    var BYE_PARTICIPANT = { id: null, name: 'BYE', hc: '' };

    setState(function(prev) {
      var newBracket  = deepClone(prev.bracket);
      var key         = slot === 1 ? 'p1' : 'p2';
      var participant = participantId === BYE_VALUE
        ? BYE_PARTICIPANT
        : (participantId
          ? (prev.participants.find(function(p) { return String(p.id) === String(participantId); }) || null)
          : null);

      var match      = newBracket.rounds[roundIdx][matchIdx];
      var prevWinner = match.winner;
      match[key]     = participant;
      match.score1   = '';
      match.score2   = '';
      match.winner   = null;
      match.status   = 'pending';
      if (prevWinner) {
        cascadeClearWinnerMut(newBracket, roundIdx, matchIdx);
      }

      // BYE auto-advance rules (no score needed):
      //   real vs BYE  → real player advances
      //   BYE vs real  → real player advances
      //   BYE vs BYE   → BYE advances (propagates to next round as BYE)
      //   null vs null → nothing advances
      var p1 = match.p1;
      var p2 = match.p2;
      var p1IsReal = p1 && p1.id != null;
      var p2IsReal = p2 && p2.id != null;
      var p1IsBye  = p1 && p1.name === 'BYE';
      var p2IsBye  = p2 && p2.name === 'BYE';

      if (p1IsReal && !p2IsReal) {
        var byeWinner = prev.participants.find(function(p) { return String(p.id) === String(p1.id); }) || p1;
        match.winner = byeWinner;
        match.status = 'done';
        if (window.BilposTournament) window.BilposTournament.advanceWinner(newBracket, 0, matchIdx, byeWinner);
      } else if (!p1IsReal && p2IsReal) {
        var byeWinner = prev.participants.find(function(p) { return String(p.id) === String(p2.id); }) || p2;
        match.winner = byeWinner;
        match.status = 'done';
        if (window.BilposTournament) window.BilposTournament.advanceWinner(newBracket, 0, matchIdx, byeWinner);
      } else if (!p1IsReal && !p2IsReal && (p1IsBye || p2IsBye)) {
        // BYE vs BYE (or BYE vs null) — advance BYE to next round
        match.winner = BYE_PARTICIPANT;
        match.status = 'done';
        if (window.BilposTournament) window.BilposTournament.advanceWinner(newBracket, 0, matchIdx, BYE_PARTICIPANT);
      }

      var newParticipants = syncParticipantDrawingNumbers(prev.participants, newBracket);
      if (newParticipants !== prev.participants) {
        if (window.BilposStorage && typeof window.BilposStorage.saveParticipants === 'function') {
          window.BilposStorage.saveParticipants(newParticipants);
        }
        participantUpdatePending.current = true;
      }

      saveState(newBracket, prev.liveMatchIds);
      return { bracket: newBracket, liveMatchIds: prev.liveMatchIds, participants: newParticipants };
    });
  }, [saveState]);

  var handleToggleLive = useCallback(function(matchId) {
    setState(function(prev) {
      var newLiveMatchIds = new Set(prev.liveMatchIds);
      // Toggle: add if not present, remove if already active
      if (newLiveMatchIds.has(matchId)) {
        newLiveMatchIds.delete(matchId);
      } else {
        newLiveMatchIds.add(matchId);
      }
      saveState(prev.bracket, newLiveMatchIds);
      return { bracket: prev.bracket, liveMatchIds: newLiveMatchIds, participants: prev.participants };
    });
  }, [saveState]);

  if (!state.bracket || !state.bracket.rounds || state.bracket.rounds.length === 0) {
    return (
      <div className="bracket-empty">
        <div className="bracket-empty-icon">🏆</div>
        <p>Setup tournament terlebih dahulu dan tambahkan peserta di menu Tournament Setup.</p>
      </div>
    );
  }

  const usedParticipantIds = new Set(
    (state.bracket?.rounds?.[0] ?? [])
      .flatMap(m => [m.p1, m.p2])
      .filter(Boolean)
      .map(p => String(p.id))
  );

  const rounds = state.bracket?.rounds ?? [];
  const totalRounds = rounds.length;
  const roundLabels = rounds.map((_, i) =>
    window.BilposTournament
      ? window.BilposTournament.getRoundLabel(i, totalRounds)
      : String(i + 1)
  );

  return (
    <BracketView
      bracket={state.bracket}
      participants={state.participants}
      liveMatchIds={state.liveMatchIds}
      onScoreChange={handleScoreChange}
      onSelectParticipant={handleSelectParticipant}
      onToggleLive={handleToggleLive}
      usedParticipantIds={usedParticipantIds}
      roundLabels={roundLabels}
    />
  );
}
