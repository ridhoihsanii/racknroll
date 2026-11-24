import React, { useState, useEffect } from 'react';
import './Bracket.css';
import RoundColumn from './RoundColumn';
import MobileRoundView from './MobileRoundView';

export default function BracketView({
  bracket, participants, liveMatchIds,
  onScoreChange, onSelectParticipant, onToggleLive,
  usedParticipantIds, roundLabels,
}) {
  var rounds      = bracket.rounds;
  var totalRounds = rounds.length;
  var isMobile    = useIsMobile();
  var [showFull, setShowFull] = useState(false);

  if (isMobile && !showFull) {
    return (
      <div>
        <button className="mobile-view-toggle" onClick={function() { setShowFull(true); }}>
          Lihat bagan penuh
        </button>
        <MobileRoundView
          bracket={bracket}
          participants={participants}
          liveMatchIds={liveMatchIds}
          usedParticipantIds={usedParticipantIds}
          roundLabels={roundLabels}
          onScoreChange={onScoreChange}
          onSelectParticipant={onSelectParticipant}
          onToggleLive={onToggleLive}
        />
      </div>
    );
  }

  return (
    <div>
      {isMobile && (
        <button className="mobile-view-toggle" onClick={function() { setShowFull(false); }}>
          Kembali ke tampilan per ronde
        </button>
      )}
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
    </div>
  );
}

function useIsMobile() {
  var query = '(max-width: 767px)';
  var [matches, setMatches] = useState(function() {
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;
  });
  useEffect(function() {
    if (!window.matchMedia) return undefined;
    var mql = window.matchMedia(query);
    function onChange(e) { setMatches(e.matches); }
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return function() {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return matches;
}
