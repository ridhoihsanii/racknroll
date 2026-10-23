(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // reduced dimensions to improve layout fit on smaller viewports
  var CARD_WIDTH = 220;
  var CARD_HEIGHT = 96;
  var CARD_RADIUS = 12;
  var BASE_GAP = 8;
  var LABEL_HEIGHT = 48;
  var ROUND_WIDTH = 240;
  var ROUND_GAP = 40;
  var ROUND_STEP = ROUND_WIDTH + ROUND_GAP;

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text != null) {
      element.textContent = String(text);
    }

    return element;
  }

  function addClass(element, className, condition) {
    if (element && element.classList && condition) {
      element.classList.add(className);
    }
  }

  function toArray(nodes) {
    if (!nodes) {
      return [];
    }

    return Array.prototype.slice.call(nodes);
  }

  function isByeParticipant(participant) {
    return !!(participant && participant.name === 'BYE');
  }

  function isMissingParticipant(participant) {
    return participant == null;
  }

  function isPlayableParticipant(participant) {
    return !!participant && !isByeParticipant(participant);
  }

  function sameParticipant(left, right) {
    if (!left || !right) {
      return false;
    }

    if (left.id != null && right.id != null) {
      return String(left.id) === String(right.id);
    }

    if (left.drawingNumber != null && right.drawingNumber != null) {
      return String(left.drawingNumber) === String(right.drawingNumber);
    }

    return left.name && right.name && String(left.name) === String(right.name);
  }

  function getRoundStep(roundIndex) {
    return (CARD_HEIGHT + BASE_GAP) * Math.pow(2, roundIndex);
  }

  function getRoundOffset(roundIndex) {
    return ((CARD_HEIGHT + BASE_GAP) * (Math.pow(2, roundIndex) - 1)) / 2;
  }

  function getContentHeight(totalRounds, rounds) {
    var maxBottom = 0;
    var roundIndex;

    for (roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
      var round = rounds[roundIndex] || [];
      var topOffset = getRoundOffset(roundIndex);
      var step = getRoundStep(roundIndex);
      var count = round.length;

      if (count === 0) {
        continue;
      }

      var bottom = LABEL_HEIGHT + topOffset + (count - 1) * step + CARD_HEIGHT;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }

    return maxBottom + 24;
  }

  function getOffsetRelativeTo(element, ancestor) {
    var top = 0;
    var left = 0;
    var node = element;

    while (node && node !== ancestor) {
      top += typeof node.offsetTop === 'number' ? node.offsetTop : 0;
      left += typeof node.offsetLeft === 'number' ? node.offsetLeft : 0;

      if ((!node.offsetTop && node.style && node.style.top)) {
        top += parseFloat(node.style.top || 0) || 0;
      }

      if ((!node.offsetLeft && node.style && node.style.left)) {
        left += parseFloat(node.style.left || 0) || 0;
      }

      node = node.offsetParent;
    }

    return { top: top, left: left };
  }

  function getBoxMetric(element, offsetName, styleName, fallback) {
    var metric = element ? element[offsetName] : 0;

    if (typeof metric === 'number' && metric > 0) {
      return metric;
    }

    if (element && element.style && element.style[styleName]) {
      return parseFloat(element.style[styleName]) || fallback;
    }

    return fallback;
  }

  function applyBoxMetrics(element, left, top, width, height) {
    if (!element || !element.style) {
      return;
    }

    if (left != null) {
      element.style.left = left + 'px';
    }

    if (top != null) {
      element.style.top = top + 'px';
    }

    if (width != null) {
      element.style.width = width + 'px';
    }

    if (height != null) {
      element.style.height = height + 'px';
    }
  }

  function appendPlayerInfo(parent, participant) {
    var info = createElement('div', 'player-info');
    var slot = createElement('span', 'player-slot');
    var name = createElement('span', 'player-name');
    var badge;

    var isBye = participant && (participant.name === 'BYE');
    slot.textContent = (participant && participant.drawingNumber != null && !isBye) ? '#' + participant.drawingNumber : '#—';
    name.textContent = (participant && participant.name && !isBye) ? participant.name : 'TBD';

    if (!participant || isBye) {
      name.classList.add('tbd');
    }

    info.appendChild(slot);
    info.appendChild(name);

    if (!isBye && participant && participant.hc !== '' && participant.hc != null) {
      badge = createElement('span', 'hc-badge', participant.hc);
      info.appendChild(badge);
    }

    parent.appendChild(info);
  }

  function appendScoreInput(parent, match, roundIndex, matchIndex, playerIndex, disabled) {
    var input = createElement('input', 'score-input');
    var scoreKey = playerIndex === 1 ? 'score1' : 'score2';

    input.type = 'number';
    input.value = match && match[scoreKey] != null ? String(match[scoreKey]) : '';
    input.min = '0';
    input.max = '99';
    input.dataset.round = String(roundIndex);
    input.dataset.match = String(matchIndex);
    input.dataset.player = String(playerIndex);

    // Prefer CSS control for sizing/appearance to avoid inline conflicts
    // keep class 'score-input' and only set disabled programmatically
    if (disabled) {
      input.disabled = true;
    }

    parent.appendChild(input);
  }

  function renderPlayerRow(match, participant, roundIndex, matchIndex, playerIndex) {
    var winner = match && match.winner;
    var row = createElement('div', 'match-player');
    var disabled = match && match.status === 'done';

    row.dataset.player = String(playerIndex);
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '12px';
    row.style.minHeight = '40px';
    row.style.padding = playerIndex === 1 ? '0 0 8px' : '8px 0 0';

    addClass(row, 'player-winner', sameParticipant(winner, participant));
    addClass(row, 'player-bye', isByeParticipant(participant));

    if (row.classList.contains('player-winner')) {
      row.style.background = 'rgba(237,6,119,0.08)';
      row.style.borderRadius = '10px';
      row.style.paddingLeft = '8px';
      row.style.paddingRight = '8px';
    }

      // Build editable player info (manual editing)
      var info = createElement('div', 'player-info');
      var slot = createElement('span', 'player-slot');
      var nameEl = createElement('span', 'player-name');
      var badge;

      var isBye = participant && participant.name === 'BYE';
      if (roundIndex === 0) {
        var slotNum = (matchIndex * 2) + playerIndex;
        slot.textContent = '#' + slotNum;
      } else {
        slot.textContent = (participant && participant.drawingNumber != null && !isBye) ? '#' + participant.drawingNumber : '';
      }
      nameEl.textContent = (participant && participant.name && !isBye) ? participant.name : '';

      // remove tbd styling for empty slots
      nameEl.classList.remove('tbd');

      // Create a select dropdown for bracket slot — options populated by app after render
      var select = createElement('select', 'bracket-select');
      select.dataset.round = String(roundIndex);
      select.dataset.match = String(matchIndex);
      select.dataset.player = String(playerIndex);
      select.style.background = 'transparent';
      select.style.color = '#fff';
      select.style.border = 'none';
      select.style.width = '100%';
      select.style.fontWeight = '700';
      select.style.fontSize = '0.9rem';
      select.style.padding = '4px 6px';
      // Show select dropdown (user preference) and keep editable hidden
      select.style.display = 'inline-block';
      // Add placeholder empty option
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '';
      select.appendChild(emptyOpt);

      // Create editable inline player name (kept for compatibility but hidden)
      var editable = createElement('span', 'editable-player player-name');
      editable.contentEditable = 'false';
      editable.dataset.round = String(roundIndex);
      editable.dataset.match = String(matchIndex);
      editable.dataset.player = String(playerIndex);
      editable.style.outline = 'none';
      editable.style.width = '100%';
      editable.style.display = 'none';
      editable.style.fontWeight = '700';
      editable.style.fontSize = '0.95rem';
      editable.textContent = (participant && participant.name && !isBye) ? participant.name : '';

      info.appendChild(slot);
      info.appendChild(select);
      info.appendChild(editable);

      if (participant && participant.hc !== '' && participant.hc != null) {
        badge = createElement('span', 'hc-badge', participant.hc);
        info.appendChild(badge);
      }

      row.appendChild(info);

      // Add score input for this player (manual mode) — enable editing unless match.done
      var disabled = match && match.status === 'done';
      appendScoreInput(row, match, roundIndex, matchIndex, playerIndex, disabled);

      // Add result badge (WIN/LOSE) based on match.winner
      var resultBadge = createElement('span', 'result-badge');
      try {
        if (match && match.winner) {
          if (sameParticipant(match.winner, participant)) {
            resultBadge.textContent = 'WIN';
            resultBadge.classList.add('win');
          } else {
            resultBadge.textContent = 'LOSE';
            resultBadge.classList.add('lose');
          }
        }
      } catch (err) {}
      resultBadge.style.marginLeft = '8px';
      row.appendChild(resultBadge);

      return row;
    }

  var BilposBracket = {
    currentZoom: 100,

    render: function (bracket, container) {
      var wrapper;
      var totalRounds;
      var contentHeight;
      var roundIndex;

      if (!container) {
        return null;
      }

      container.innerHTML = '';

      if (!bracket || !Array.isArray(bracket.rounds) || bracket.rounds.length === 0) {
        container.innerHTML = typeof BilposUI !== 'undefined' ? BilposUI.emptyState('bracket') : '<div class="empty-state"><div class="empty-icon">🏆</div><h5>Bracket Belum Dibuat</h5></div>';
        return null;
      }

      totalRounds = bracket.rounds.length;
      contentHeight = getContentHeight(totalRounds, bracket.rounds);
      container.style.overflow = 'auto';
      container.style.position = container.style.position || 'relative';

      wrapper = createElement('div', 'bracket-wrapper');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'block';
      wrapper.style.width = totalWidth(totalRounds) + 'px';
      wrapper.style.minHeight = contentHeight + 'px';
      wrapper.style.transform = 'scale(' + this.currentZoom / 100 + ')';
      wrapper.style.transformOrigin = 'top left';

      var orderIndices = null;
      if (bracket && typeof bracket.size === 'number' && bracket.size > 32 && totalRounds > 2) {
        var finalIdx = totalRounds - 1;
        var leftCount = Math.floor(finalIdx / 2);
        orderIndices = [];
        var ii;
        for (ii = 0; ii < leftCount; ii += 1) orderIndices.push(ii);
        orderIndices.push(finalIdx);
        for (ii = leftCount; ii < finalIdx; ii += 1) orderIndices.push(ii);
      }

      for (roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
        var round = bracket.rounds[roundIndex] || [];
        var roundColumn = createElement('div', 'bracket-round');
        var topOffset = getRoundOffset(roundIndex);
        var step = getRoundStep(roundIndex);
        var matchIndex;

        roundColumn.dataset.round = String(roundIndex);
        roundColumn.style.position = 'absolute';
        roundColumn.style.height = contentHeight + 'px';
        roundColumn.style.width = ROUND_WIDTH + 'px';
        var posIndex = orderIndices ? orderIndices.indexOf(roundIndex) : roundIndex;
        if (posIndex < 0) posIndex = roundIndex;
        applyBoxMetrics(roundColumn, posIndex * ROUND_STEP, 0, ROUND_WIDTH, contentHeight);

        // Round label (e.g., ROUND 1, SEMI FINAL, FINAL)
        try {
          var roundLabelText = 'Round ' + (roundIndex + 1);
          if (typeof BilposTournament !== 'undefined' && typeof BilposTournament.getRoundLabel === 'function') {
            roundLabelText = BilposTournament.getRoundLabel(roundIndex, totalRounds);
          }
          var roundLabel = createElement('div', 'bracket-round-label', roundLabelText);
          roundLabel.style.position = 'absolute';
          roundLabel.style.top = '8px';
          roundLabel.style.left = '12px';
          roundLabel.style.fontWeight = '800';
          roundLabel.style.color = 'var(--anteraja-primary)';
          roundLabel.style.fontSize = '0.9rem';
          roundColumn.appendChild(roundLabel);
        } catch (err) {}

        // If using two-bagan layout for large brackets, add Bagan A/B labels
        try {
          if (orderIndices) {
            var finalIdx = totalRounds - 1;
            var leftCount = Math.floor(finalIdx / 2);
            if (roundIndex === 0) {
              var labelA = createElement('div', 'bagan-label', 'Bagan A');
              labelA.style.position = 'absolute';
              labelA.style.left = '8px';
              labelA.style.top = '8px';
              labelA.style.color = 'var(--anteraja-primary)';
              labelA.style.fontWeight = '800';
              labelA.style.fontSize = '0.9rem';
              roundColumn.appendChild(labelA);
            }
            if (roundIndex === leftCount) {
              var labelB = createElement('div', 'bagan-label', 'Bagan B');
              labelB.style.position = 'absolute';
              labelB.style.left = '8px';
              labelB.style.top = '8px';
              labelB.style.color = 'var(--anteraja-primary)';
              labelB.style.fontWeight = '800';
              labelB.style.fontSize = '0.9rem';
              roundColumn.appendChild(labelB);
            }
          }
        } catch (err) {}

        for (matchIndex = 0; matchIndex < round.length; matchIndex += 1) {
          var matchCard = this.renderMatchCard(round[matchIndex], roundIndex, matchIndex, totalRounds);
          var cardTop = LABEL_HEIGHT + topOffset + step * matchIndex;

          matchCard.style.position = 'absolute';
          applyBoxMetrics(matchCard, 0, cardTop, CARD_WIDTH, CARD_HEIGHT);
          roundColumn.appendChild(matchCard);
        }

        wrapper.appendChild(roundColumn);
      }

      container.appendChild(wrapper);

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          BilposBracket.drawConnectors(wrapper);
        });
      } else {
        this.drawConnectors(wrapper);
      }

      return wrapper;
    },

    renderMatchCard: function (match, roundIndex, matchIndex, totalRounds) {
      var card = createElement('div', 'match-card');
      var footer = createElement('div', 'match-footer');
      var separator = createElement('div', 'match-separator');
      var button;
      var hasBye = isByeParticipant(match && match.p1) || isByeParticipant(match && match.p2);
      var hasPendingSlot = isMissingParticipant(match && match.p1) || isMissingParticipant(match && match.p2);

      match = match || {};

      card.dataset.matchId = String(match.id || '');
      card.dataset.round = String(roundIndex);
      card.dataset.matchIdx = String(matchIndex);
      card.style.boxSizing = 'border-box';
      card.style.width = CARD_WIDTH + 'px';
      card.style.minHeight = CARD_HEIGHT + 'px';
      card.style.padding = '12px 14px';
      card.style.borderRadius = CARD_RADIUS + 'px';
      card.style.border = '1px solid rgba(237,6,119,0.18)';
      card.style.background = 'linear-gradient(180deg, var(--anteraja-surface) 0%, var(--anteraja-dark) 100%)';
      card.style.boxShadow = '0 12px 30px rgba(0,0,0,0.38)';
      card.style.color = 'var(--anteraja-primary-contrast)';

      addClass(card, 'match-live', match.status === 'live');
      addClass(card, 'match-done', match.status === 'done');
      addClass(card, 'match-bye', hasBye);

      if (match.status === 'live') {
        card.style.borderColor = 'rgba(237,6,119,0.5)';
        card.style.boxShadow = '0 16px 40px rgba(237,6,119,0.16)';
      }

      if (match.status === 'done') {
        card.style.opacity = '0.92';
      }

      card.appendChild(renderPlayerRow(match, match.p1 || null, roundIndex, matchIndex, 1));

      separator.style.height = '1px';
      separator.style.margin = '0 0 0 8px';
      separator.style.background = 'rgba(148,163,184,0.22)';
      card.appendChild(separator);

      card.appendChild(renderPlayerRow(match, match.p2 || null, roundIndex, matchIndex, 2));

      footer.style.display = 'flex';
      footer.style.alignItems = 'center';
      footer.style.justifyContent = 'flex-end';
      footer.style.marginTop = '8px';
      footer.style.minHeight = '28px';

      if (match.status === 'done') {
        var doneBadge = createElement('span', 'match-done-badge', '✓ SELESAI');

        doneBadge.style.color = '#86efac';
        doneBadge.style.fontWeight = '800';
        doneBadge.style.fontSize = '12px';
        doneBadge.style.letterSpacing = '0.08em';
        footer.appendChild(doneBadge);
      } else {
        button = createElement('button', 'btn-playing');
        button.dataset.round = String(roundIndex);
        button.dataset.match = String(matchIndex);
        button.type = 'button';
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.gap = '8px';
        button.style.height = '30px';
        button.style.padding = '0 12px';
        button.style.borderRadius = '999px';
        button.style.border = '1px solid rgba(237,6,119,0.3)';
        button.style.background = 'rgba(237,6,119,0.1)';
        button.style.color = '#F6AABF';
        button.style.fontSize = '11px';
        button.style.fontWeight = '800';
        button.style.letterSpacing = '0.08em';

        if (match.status === 'live') {
          var liveDot = createElement('span', 'live-dot');
          var liveLabel = createElement('span', '', 'LIVE');

          liveDot.style.width = '8px';
          liveDot.style.height = '8px';
          liveDot.style.borderRadius = '50%';
          liveDot.style.background = '#ef4444';
          liveDot.style.boxShadow = '0 0 0 6px rgba(239,68,68,0.18)';
          button.appendChild(liveDot);
          button.appendChild(liveLabel);
          button.classList.add('active');
        } else {
          button.appendChild(createElement('span', '', '▶ PLAYING'));
        }

        if (hasBye || hasPendingSlot) {
          button.disabled = true;
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
        }

        footer.appendChild(button);
      }

      // small manual-live toggle dot (top-right)
      var toggleDot = createElement('button', 'match-toggle-dot');
      toggleDot.type = 'button';
      toggleDot.dataset.round = String(roundIndex);
      toggleDot.dataset.match = String(matchIndex);
      toggleDot.setAttribute('aria-label','Toggle live');
      toggleDot.style.position = 'absolute';
      toggleDot.style.top = '8px';
      toggleDot.style.right = '10px';
      toggleDot.style.zIndex = '6';
      if (match && match._manualLive) {
        toggleDot.classList.add('active');
        card.classList.add('match-manual-live');
      }
      card.appendChild(toggleDot);

      card.appendChild(footer);
 
      return card;
    },

    drawConnectors: function (wrapper) {
      var rounds;
      var svg;
      var totalPaths = [];
      var svgWidth;
      var svgHeight;
      var roundIndex;

      if (!wrapper) {
        return null;
      }

      toArray(wrapper.querySelectorAll('.connector-svg')).forEach(function (existing) {
        existing.remove();
      });

      rounds = toArray(wrapper.querySelectorAll('.bracket-round'));
      if (rounds.length < 2) {
        return null;
      }

      svgWidth = Math.max(getBoxMetric(wrapper, 'offsetWidth', 'width', totalWidth(rounds.length)), totalWidth(rounds.length));
      svgHeight = Math.max(getBoxMetric(wrapper, 'offsetHeight', 'minHeight', 0), getBoxMetric(wrapper, 'clientHeight', 'minHeight', 0));

      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'connector-svg');
      svg.setAttribute('width', String(svgWidth));
      svg.setAttribute('height', String(svgHeight));
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.pointerEvents = 'none';
      svg.style.overflow = 'visible';
      applyBoxMetrics(svg, 0, 0, svgWidth, svgHeight);

      for (roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
        var currentCards = toArray(rounds[roundIndex].querySelectorAll('.match-card'));

        // Perbaikan Logika Utama: Ambil kolom round berikutnya berdasarkan atribut data-round,
        // bukan berdasarkan urutan fisik DOM array (karena urutan kolom diacak oleh orderIndices)
        var nextRoundColumn = wrapper.querySelector('.bracket-round[data-round="' + (roundIndex + 1) + '"]');
        var nextCards = nextRoundColumn ? toArray(nextRoundColumn.querySelectorAll('.match-card')) : [];

        var cardIndex;
        for (cardIndex = 0; cardIndex < currentCards.length; cardIndex += 1) {
          var current = currentCards[cardIndex];
          var target = nextCards[Math.floor(cardIndex / 2)];

          if (!current || !target) {
            continue;
          }

          var currentOffset = getOffsetRelativeTo(current, wrapper);
          var nextOffset = getOffsetRelativeTo(target, wrapper);
          var currentWidth = getBoxMetric(current, 'offsetWidth', 'width', CARD_WIDTH);
          var currentHeight = getBoxMetric(current, 'offsetHeight', 'height', CARD_HEIGHT);
          var nextHeight = getBoxMetric(target, 'offsetHeight', 'height', CARD_HEIGHT);
          var startX = currentOffset.left + currentWidth;
          var startY = currentOffset.top + currentHeight / 2;
          var endX = nextOffset.left;
          var endY = nextOffset.top + (cardIndex % 2 === 0 ? nextHeight * 0.25 : nextHeight * 0.75);
          var midX = startX + (endX - startX) / 2;
          var path = document.createElementNS(SVG_NS, 'path');
          var d = 'M ' + startX + ' ' + startY + ' H ' + midX + ' V ' + endY + ' H ' + endX;

          path.setAttribute('class', 'connector-path');
          path.setAttribute('d', d);
          path.setAttribute('stroke', 'rgba(237,6,119,0.4)');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(path);
          totalPaths.push(path);
        }
      }

      wrapper.appendChild(svg);
      return totalPaths;
    },

    setZoom: function (zoom) {
      this.currentZoom = zoom;
      var wrapper = document.querySelector('.bracket-wrapper');

      if (wrapper) {
        wrapper.style.transform = 'scale(' + zoom / 100 + ')';
        wrapper.style.transformOrigin = 'top left';
      }

      toArray(document.querySelectorAll('.zoom-btn')).forEach(function (button) {
        button.classList.toggle('active', parseInt(button.dataset.zoom, 10) === zoom);
      });
    },

    toggleFullscreen: function (container) {
      if (!document.fullscreenElement) {
        if (container && container.requestFullscreen) {
          container.requestFullscreen();
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    },

    centerBracket: function (container) {
      if (!container) {
        return;
      }

      container.scrollLeft = 0;
      container.scrollTop = 0;
    },

    centerFinal: function (container) {
      try {
        var wrapper = container && container.querySelector('.bracket-wrapper');
        if (!wrapper) return;
        var rounds = wrapper.querySelectorAll('.bracket-round');
        if (!rounds || rounds.length === 0) return;
        var finalRound = rounds[rounds.length - 1];
        var rect = finalRound.getBoundingClientRect();
        var containerRect = container.getBoundingClientRect();
        var targetLeft = finalRound.offsetLeft - (containerRect.width / 2) + (finalRound.offsetWidth / 2);
        container.scrollLeft = targetLeft;
      } catch (err) {}
    }
  };

  function totalWidth(totalRounds) {
    if (!totalRounds || totalRounds < 1) {
      return ROUND_WIDTH;
    }

    return totalRounds * ROUND_WIDTH + (totalRounds - 1) * ROUND_GAP;
  }

  if (typeof window !== 'undefined') {
    window.BilposBracket = BilposBracket;
  }
})();
