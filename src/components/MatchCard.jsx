import React from 'react';
import ParticipantSlot from './ParticipantSlot';
import ScoreInput from './ScoreInput';

export default function MatchCard({
  match, matchNum, roundIdx, matchIdx,
  participants, usedParticipantIds,
  liveMatchIds, onScoreChange, onSelectParticipant, onToggleLive,
}) {
  const isFirstRound = roundIdx === 0;
  const isLive = liveMatchIds instanceof Set ? liveMatchIds.has(match.id) : false;
  var winner    = match.winner;
  var winnerIsReal = winner && winner.id != null;
  var p1IsWin   = winnerIsReal && match.p1 && match.p1.id != null && String(winner.id) === String(match.p1.id);
  var p2IsWin   = winnerIsReal && match.p2 && match.p2.id != null && String(winner.id) === String(match.p2.id);
  var bothScored = match.score1 !== '' && match.score1 != null
                && match.score2 !== '' && match.score2 != null;
  var hasAnyScore = [match.score1, match.score2].some(function(score) {
    return score != null && String(score).trim() !== '';
  });
  var p1IsBye   = match.p1 && match.p1.name === 'BYE';
  var p2IsBye   = match.p2 && match.p2.name === 'BYE';
  var isByeMatch = p1IsBye || p2IsBye;

  return (
    <div className={'match-card' + (isLive ? ' is-live' : '')}>

      {/* Header */}
      <div className="match-header">
        <span className="match-number">Match #{matchNum}</span>
        <button
          className={'live-btn' + (isLive ? ' active' : '')}
          onClick={function() { onToggleLive(match.id); }}
          disabled={isByeMatch || hasAnyScore}
          title={isLive ? 'Nonaktifkan LIVE' : 'Tandai sebagai LIVE'}
        >
          {isLive ? '🔴 LIVE' : 'LIVE'}
        </button>
      </div>

      {/* Participant 1 row */}
      <div className={'match-slot' + (p1IsWin ? ' winner-slot' : p2IsWin ? ' loser-slot' : '')}>
        <ParticipantSlot
          participant={match.p1}
          isFirstRound={isFirstRound}
          participants={participants}
          usedParticipantIds={usedParticipantIds}
          onSelect={function(id) { onSelectParticipant(roundIdx, matchIdx, 1, id); }}
        />
        {!p1IsBye && !isByeMatch && (isFirstRound || (match.p1 && match.p1.id != null)) && (
          <ScoreInput
            value={match.score1}
            onChange={function(v) { onScoreChange(roundIdx, matchIdx, 1, v); }}
            disabled={false}
          />
        )}
        {bothScored && match.winner && (
          <span className={'badge ' + (p1IsWin ? 'win' : 'lose')}>
            {p1IsWin ? 'WIN' : 'LOSE'}
          </span>
        )}
      </div>

      {/* Participant 2 row */}
      <div className={'match-slot' + (p2IsWin ? ' winner-slot' : p1IsWin ? ' loser-slot' : '')}>
        <ParticipantSlot
          participant={match.p2}
          isFirstRound={isFirstRound}
          participants={participants}
          usedParticipantIds={usedParticipantIds}
          onSelect={function(id) { onSelectParticipant(roundIdx, matchIdx, 2, id); }}
        />
        {!p2IsBye && !isByeMatch && (isFirstRound || (match.p2 && match.p2.id != null)) && (
          <ScoreInput
            value={match.score2}
            onChange={function(v) { onScoreChange(roundIdx, matchIdx, 2, v); }}
            disabled={false}
          />
        )}
        {bothScored && match.winner && (
          <span className={'badge ' + (p2IsWin ? 'win' : 'lose')}>
            {p2IsWin ? 'WIN' : 'LOSE'}
          </span>
        )}
      </div>
    </div>
  );
}
