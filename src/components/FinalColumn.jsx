import React from 'react';
import MatchCard from './MatchCard';
import { computeMatchAreaHeight, computeMatchTop } from './bracketUtils';

export default function FinalColumn({
  final, bracketSize, participants, liveMatchIds, usedParticipantIds,
  onScoreChange, onSelectParticipant, onToggleLive,
}) {
  return (
    <div className="final-column">
      <div className="round-label bracket-final-label">FINAL</div>
      <div className="final-match-area" style={{
        height: computeMatchAreaHeight(final.roundIdx - 1, 1) + 'px',
      }}>
        <div className="match-wrapper bracket-center-final" style={{
          top: computeMatchTop(final.roundIdx - 1, 0) + 'px',
        }}>
          <MatchCard
            match={final.match}
            matchNum={bracketSize - 1}
            roundIdx={final.roundIdx}
            matchIdx={final.matchIdx}
            isFirstRound={false}
            participants={participants}
            usedParticipantIds={usedParticipantIds}
            liveMatchIds={liveMatchIds}
            onScoreChange={onScoreChange}
            onSelectParticipant={onSelectParticipant}
            onToggleLive={onToggleLive}
          />
        </div>
      </div>
    </div>
  );
}
