// src/components/bracketUtils.js
// Pure logic utilities for the React bracket module.
// Uses CommonJS exports so Node.js tests can require() directly.

const CARD_HEIGHT = 100;
const CARD_GAP    = 8;
const ROUND_GAP   = 48;
const ARM_LENGTH  = 24; // = ROUND_GAP / 2

function getHcLabel(p) {
  if (!p) return '';
  const custom = String(p.hcCustom || '').trim();
  const hc     = String(p.hc     || '').trim();
  if (hc === 'custom' || custom) return custom || hc;
  return hc;
}

function getParticipantLabel(p) {
  if (!p || !p.name) return '';
  const hc = getHcLabel(p);
  return hc ? p.name + ' - ' + hc : p.name;
}

// Returns { marginTop: number } – legacy, kept for tests
function computeMatchMargins(roundIdx, matchIdx) {
  var step   = (CARD_HEIGHT + CARD_GAP) * Math.pow(2, roundIdx);
  var offset = step / 2 - CARD_HEIGHT / 2;
  return { marginTop: matchIdx === 0 ? offset : step - CARD_HEIGHT };
}

// Returns the absolute `top` px value for a match card within its match-area.
// Formula: top = matchIdx * step + (step - CARD_HEIGHT) / 2
// This places each winner match exactly at the midpoint between its two feeder matches.
function computeMatchTop(roundIdx, matchIdx) {
  var step = (CARD_HEIGHT + CARD_GAP) * Math.pow(2, roundIdx);
  return matchIdx * step + (step - CARD_HEIGHT) / 2;
}

// Returns the required height in px of the match-area container for a round.
function computeMatchAreaHeight(roundIdx, numMatches) {
  if (numMatches === 0) return 0;
  var step    = (CARD_HEIGHT + CARD_GAP) * Math.pow(2, roundIdx);
  var lastTop = (numMatches - 1) * step + (step - CARD_HEIGHT) / 2;
  return lastTop + CARD_HEIGHT;
}

// Returns the height in px of the vertical connector pseudo-element
function computeConnectorHeight(roundIdx) {
  var step = (CARD_HEIGHT + CARD_GAP) * Math.pow(2, roundIdx);
  return step / 2;
}

function getSplitBracketLayout(bracket) {
  if (!bracket || (bracket.size !== 64 && bracket.size !== 128)) return null;
  if (!Array.isArray(bracket.rounds) || bracket.rounds.length < 2) return null;

  var finalRound = bracket.rounds[bracket.rounds.length - 1];
  if (!Array.isArray(finalRound) || finalRound.length !== 1) return null;

  function splitSide(side) {
    return bracket.rounds.slice(0, -1).map(function(round, roundIdx) {
      if (!Array.isArray(round) || round.length < 2 || round.length % 2 !== 0) return null;
      var midpoint = round.length / 2;
      var start = side === 'left' ? 0 : midpoint;
      var end = side === 'left' ? midpoint : round.length;
      return {
        round: round.slice(start, end),
        roundIdx: roundIdx,
        matchIndices: Array.from({ length: end - start }, function(_, i) { return start + i; })
      };
    });
  }

  var leftRounds = splitSide('left');
  var rightRounds = splitSide('right');
  if (leftRounds.some(function(round) { return !round; })
      || rightRounds.some(function(round) { return !round; })) return null;

  return {
    leftRounds: leftRounds,
    rightRounds: rightRounds,
    final: { match: finalRound[0], roundIdx: bracket.rounds.length - 1, matchIdx: 0 }
  };
}

function getFitScale(viewportHeight, contentHeight) {
  var viewport = Number(viewportHeight);
  var content = Number(contentHeight);
  if (!Number.isFinite(viewport) || viewport <= 0
      || !Number.isFinite(content) || content <= 0) return 1;
  return Math.min(1, viewport / content);
}

function clampZoom(zoom, fitZoom) {
  var requested = Number(zoom);
  var minimum = Number(fitZoom);
  if (!Number.isFinite(minimum) || minimum <= 0) minimum = 1;
  if (!Number.isFinite(requested)) requested = minimum;
  return Math.max(requested, minimum);
}

// Returns the winning participant or null
// Null if either score is empty/null, or if scores are equal
function resolveWinner(match) {
  if (!match) return null;
  var s1 = match.score1;
  var s2 = match.score2;
  if (s1 === '' || s1 == null || s2 === '' || s2 == null) return null;
  var n1 = Number(s1);
  var n2 = Number(s2);
  if (n1 === n2) return null;
  return n1 > n2 ? match.p1 : match.p2;
}

module.exports = {
  CARD_HEIGHT,
  CARD_GAP,
  ROUND_GAP,
  ARM_LENGTH,
  getHcLabel,
  getParticipantLabel,
  computeMatchMargins,
  computeMatchTop,
  computeMatchAreaHeight,
  computeConnectorHeight,
  getSplitBracketLayout,
  getFitScale,
  clampZoom,
  resolveWinner,
};
