import React from 'react';
import './Bracket.css';
import RoundColumn from './RoundColumn';
import FinalColumn from './FinalColumn';
import { getSplitBracketLayout } from './bracketUtils';

export default function BracketView({
  bracket, participants, liveMatchIds,
  onScoreChange, onSelectParticipant, onToggleLive,
  usedParticipantIds, roundLabels,
}) {
  var rounds      = bracket.rounds;
  var totalRounds = rounds.length;
  var splitLayout = getSplitBracketLayout(bracket);

  if (splitLayout) {
    var sharedProps = {
      participants: participants,
      liveMatchIds: liveMatchIds,
      usedParticipantIds: usedParticipantIds,
      onScoreChange: onScoreChange,
      onSelectParticipant: onSelectParticipant,
      onToggleLive: onToggleLive,
    };

    return (
      <div className="bracket-scroll-container">
        <div className="bracket-view bracket-split-view">
          <div className="bracket-tree bracket-left-tree">
            {splitLayout.leftRounds.map(function(item) {
              return (
                <RoundColumn
                  key={item.roundIdx}
                  round={item.round}
                  roundIdx={item.roundIdx}
                  totalRounds={totalRounds}
                  matchIndices={item.matchIndices}
                  direction="inward-right"
                  {...sharedProps}
                />
              );
            })}
          </div>
          <FinalColumn final={splitLayout.final} bracketSize={bracket.size} {...sharedProps} />
          <div className="bracket-tree bracket-right-tree">
            {splitLayout.rightRounds.slice().reverse().map(function(item) {
              return (
                <RoundColumn
                  key={item.roundIdx}
                  round={item.round}
                  roundIdx={item.roundIdx}
                  totalRounds={totalRounds}
                  matchIndices={item.matchIndices}
                  direction="inward-left"
                  {...sharedProps}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bracket-scroll-container">
      <div className="bracket-view">
        {rounds.map(function(round, roundIdx) {
          return (
            <RoundColumn
              key={roundIdx}
              round={round}
              roundIdx={roundIdx}
              totalRounds={totalRounds}
              participants={participants}
              usedParticipantIds={usedParticipantIds}
              roundLabel={roundLabels && roundLabels[roundIdx]}
              liveMatchIds={liveMatchIds}
              onScoreChange={onScoreChange}
              onSelectParticipant={onSelectParticipant}
              onToggleLive={onToggleLive}
            />
          );
        })}
      </div>
    </div>
  );
}
