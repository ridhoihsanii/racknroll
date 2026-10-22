import React from 'react';
import MatchCard from './MatchCard';
import { computeMatchMargins, computeMatchTop, computeMatchAreaHeight, computeConnectorHeight } from './bracketUtils';

function getRoundLabel(roundIdx, totalRounds) {
  var fromEnd = totalRounds - 1 - roundIdx;
  if (fromEnd === 0) return 'FINAL';
  if (fromEnd === 1) return 'SEMI FINAL';
  // "N besar" = number of remaining players = 2^(fromEnd+1)
  var n = Math.pow(2, fromEnd + 1);
  return n + ' BESAR';
}

// Global sequential match number offset for this round
// (sum of all matches in preceding rounds)
function getMatchNumOffset(roundIdx, totalRounds) {
  var totalSlots = Math.pow(2, totalRounds);
  var offset = 0;
  for (var r = 0; r < roundIdx; r++) {
    offset += totalSlots / Math.pow(2, r + 1);
  }
  return offset;
}

export default function RoundColumn({
  round, roundIdx, totalRounds, participants, usedParticipantIds, roundLabel,
  matchIndices, direction,
  liveMatchIds, onScoreChange, onSelectParticipant, onToggleLive,
}) {
  var isFirstRound = roundIdx === 0;
  var isFinalRound = roundIdx === totalRounds - 1;
  var flowsLeft = direction === 'inward-left';
  var connectorH   = computeConnectorHeight(roundIdx);
  var matchOffset  = getMatchNumOffset(roundIdx, totalRounds);
  var displayLabel = roundLabel || getRoundLabel(roundIdx, totalRounds);

  // Shared match card renderer
  function renderMatch(match, localMatchIdx, wrapperStyle) {
    var matchIdx = matchIndices ? matchIndices[localMatchIdx] : localMatchIdx;
    var isTop        = localMatchIdx % 2 === 0;
    var hasLeftArm   = !isFirstRound && !flowsLeft;
    var hasRightArm  = !isFirstRound && flowsLeft;
    var connectorTop = !isFinalRound && isTop;
    var connectorBot = !isFinalRound && !isTop;

    var wrapperClass = 'match-wrapper'
      + (hasLeftArm   ? ' has-left-arm'      : '')
      + (hasRightArm  ? ' has-right-arm'     : '')
      + (connectorTop ? ' connector-top'     : '')
      + (connectorBot ? ' connector-bottom'  : '')
      + (flowsLeft    ? ' flow-left'         : '');

    return (
      <div key={match.id} className={wrapperClass} style={wrapperStyle}>
        <MatchCard
          match={match}
          matchNum={matchOffset + matchIdx + 1}
          roundIdx={roundIdx}
          matchIdx={matchIdx}
          isFirstRound={isFirstRound}
          participants={participants}
          usedParticipantIds={usedParticipantIds}
          liveMatchIds={liveMatchIds}
          onScoreChange={onScoreChange}
          onSelectParticipant={onSelectParticipant}
          onToggleLive={onToggleLive}
        />
      </div>
    );
  }

  // ── Round 1 (R0): keep original flex + margin-top layout unchanged ──
  if (isFirstRound) {
    return (
      <div className="round-column">
        <div className="round-label">{displayLabel}</div>
        {round.map(function(match, localMatchIdx) {
          var margins = computeMatchMargins(0, localMatchIdx);
          return renderMatch(match, localMatchIdx, {
            marginTop:       margins.marginTop + 'px',
            '--connector-h': connectorH + 'px',
          });
        })}
      </div>
    );
  }

  // ── Winner rounds (R1+): absolute positioning so each winner bracket
  //    sits exactly at the median between its two feeder brackets ──
  var matchAreaH = computeMatchAreaHeight(roundIdx, round.length);
  return (
    <div className="round-column">
      <div className="round-label">{displayLabel}</div>
      <div className="match-area" style={{ height: matchAreaH + 'px' }}>
        {round.map(function(match, localMatchIdx) {
          var topY = computeMatchTop(roundIdx, localMatchIdx);
          return renderMatch(match, localMatchIdx, {
            position:        'absolute',
            top:             topY + 'px',
            '--connector-h': connectorH + 'px',
          });
        })}
      </div>
    </div>
  );
}
