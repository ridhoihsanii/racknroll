import React, { useState, useEffect, useRef } from 'react';
import MatchCard from './MatchCard';
import { getMatchNumOffset } from './RoundColumn';

// Mobile-friendly bracket: one round at a time as a vertical list of match cards.
export default function MobileRoundView({
  bracket, participants, liveMatchIds, usedParticipantIds, roundLabels,
  onScoreChange, onSelectParticipant, onToggleLive,
}) {
  var rounds = bracket.rounds;
  var totalRounds = rounds.length;
  var [activeRound, setActiveRound] = useState(0);
  var touchStartX = useRef(null);
  var tabsRef = useRef(null);

  var safeRound = Math.min(activeRound, totalRounds - 1);
  var round = rounds[safeRound] || [];
  var offset = getMatchNumOffset(safeRound, totalRounds);

  useEffect(function() {
    var el = tabsRef.current && tabsRef.current.querySelector('.active');
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [safeRound]);

  function go(delta) {
    setActiveRound(function(r) { return Math.max(0, Math.min(totalRounds - 1, r + delta)); });
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    var dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 80) go(dx < 0 ? 1 : -1);
  }

  function doneCount(r) {
    return rounds[r].filter(function(m) { return m.winner; }).length;
  }

  return (
    <div className="mobile-round-view">
      <div className="mobile-round-tabs" ref={tabsRef} role="tablist">
        {rounds.map(function(r, i) {
          return (
            <button
              key={i}
              role="tab"
              aria-selected={i === safeRound}
              className={'mobile-round-tab' + (i === safeRound ? ' active' : '')}
              onClick={function() { setActiveRound(i); }}
            >
              {roundLabels && roundLabels[i] ? roundLabels[i] : 'Ronde ' + (i + 1)}
              <span className="mobile-round-progress">{doneCount(i)}/{r.length}</span>
            </button>
          );
        })}
      </div>

      <div className="mobile-round-list" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {round.map(function(match, matchIdx) {
          return (
            <MatchCard
              key={match.id}
              match={match}
              matchNum={offset + matchIdx + 1}
              roundIdx={safeRound}
              matchIdx={matchIdx}
              participants={participants}
              usedParticipantIds={usedParticipantIds}
              liveMatchIds={liveMatchIds}
              onScoreChange={onScoreChange}
              onSelectParticipant={onSelectParticipant}
              onToggleLive={onToggleLive}
            />
          );
        })}
      </div>

      <div className="mobile-round-nav">
        <button onClick={function() { go(-1); }} disabled={safeRound === 0}>&larr; Sebelumnya</button>
        <button onClick={function() { go(1); }} disabled={safeRound === totalRounds - 1}>Berikutnya &rarr;</button>
      </div>
    </div>
  );
}
