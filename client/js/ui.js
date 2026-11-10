// client/js/ui.js
const UI = {
  screens: {},
  _currentPrefix: '',

  init() {
    this.screens = {
      landing: document.getElementById('landing-screen'),
      lobby: document.getElementById('lobby-screen'),
      game: document.getElementById('game-screen'),
      gameover: document.getElementById('gameover-screen'),
    };
  },

  showScreen(name) {
    Object.entries(this.screens).forEach(([key, el]) => {
      if (!el) return;
      if (key === name) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  },

  // ─── LOBBY ───
  renderLobby(room, myId) {
    const codeEl = document.getElementById('lobby-room-code');
    if (codeEl) codeEl.textContent = room.code;
    const countEl = document.getElementById('player-count');
    if (countEl) countEl.textContent = `${room.players.length}/5`;

    const list = document.getElementById('player-list');
    if (list) {
      list.innerHTML = room.players.map(p => `
        <div class="player-item">
          <div class="player-avatar">${p.name[0].toUpperCase()}</div>
          <span class="player-name-lobby">${p.name}</span>
          ${p.isHost ? '<span class="host-badge">👑 HOST</span>' : ''}
          ${p.id === myId ? '<span class="you-badge">KAMU</span>' : ''}
        </div>
      `).join('');
    }

    const startBtn = document.getElementById('start-btn');
    const statusEl = document.getElementById('lobby-status');
    if (startBtn) {
      if (room.hostId === myId) {
        startBtn.classList.remove('hidden');
        startBtn.disabled = room.players.length < 2;
        startBtn.textContent = room.players.length < 2
          ? '⏳ Tunggu Player Lain (Min. 2)'
          : '▶ MULAI GAME!';
      } else {
        startBtn.classList.add('hidden');
      }
    }
    if (statusEl) {
      statusEl.textContent = room.players.length < 2
        ? 'Nunggu yang lain gabung dulu...'
        : `${room.players.length} pemain siap! Nunggu host mulai... 👀`;
    }
  },

  // ─── GAME: RENDER PLAYERS ───
  renderPlayers(players, currentPlayerId, myId) {
    const row = document.getElementById('players-row');
    if (!row) return;

    // Slot colors — match CSS classes
    const SLOTS  = ['pc-s0','pc-s1','pc-s2','pc-s3','pc-s4','pc-s5'];
    const COLORS = ['#00d4ff','#ff2244','#00ff88','#ffcc00','#b044ff','#ff7700'];
    // Callsign prefixes — biar berasa seperti pilot
    const CALLSIGNS = ['ALPHA','BRAVO','COBRA','DELTA','EAGLE','FOXTROT'];

    row.innerHTML = players.map((p, idx) => {
      const slot        = SLOTS[idx % SLOTS.length];
      const col         = COLORS[idx % COLORS.length];
      const callsign    = CALLSIGNS[idx % CALLSIGNS.length];
      const isActive    = p.id === currentPlayerId && !p.eliminated;
      const isMe        = p.id === myId;
      const isActiveMe  = isActive && isMe;
      const isActiveOther = isActive && !isMe;

      // Initials (max 2 chars)
      const initials = p.name.trim().split(/\s+/)
        .map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';

      // Segmented life bar — 3 blocks
      const lifeSegs = Array.from({length: 3}, (_, i) =>
        `<span class="heart ${i < p.lives ? 'alive' : 'lost'}"></span>`
      ).join('');

      // Streak
      const streak = (p.streak >= 3 && !p.eliminated)
        ? `<div class="pc-streak">⚡${p.streak}×</div>` : '';

      const classes = [
        'player-card', slot,
        p.eliminated  ? 'eliminated'   : '',
        isActiveMe    ? 'active'        : '',
        isActiveOther ? 'active-other'  : '',
        isMe          ? 'is-me'         : '',
      ].filter(Boolean).join(' ');

      return `
        <div class="${classes}">
          <div class="pc-status-dot"></div>
          <div class="pc-inner">
            <div class="pc-callsign">${callsign}-0${idx+1}</div>
            <div class="pc-avatar">
              <div class="pc-avatar-hex-border"></div>
              <div class="pc-avatar-hex"></div>
              <div class="pc-avatar-text">${initials}</div>
            </div>
            <div class="pc-name">${p.name}${isMe ? '<span class="me-tag">▸ KAMU</span>' : ''}</div>
            <div class="pc-lives">${lifeSegs}</div>
            <div class="pc-words">${p.wordsCount}W</div>
            ${streak}
          </div>
          <div class="pc-sweep"></div>
          <div class="pc-elim"><span class="pc-elim-text">OFFLINE</span></div>
        </div>
      `;
    }).join('');
  },

  // ─── UPDATE PREFIXLAY ───
  // serverPrefix = awalan dari server (misal: "an")
  // typed = apa yang pemain ketik sejauh ini (misal: "ana")
  updatePrefixDisplay(serverPrefix, typed) {
    const el = document.getElementById('prefix-value');
    const hintEl = document.getElementById('prefix-hint');
    if (!el) return;

    if (!serverPrefix) {
      el.textContent = '?';
      el.innerHTML = '?';
      el.className = 'prefix-value';
      if (hintEl) hintEl.textContent = 'Nunggu giliran...';
      return;
    }

    const prefix = serverPrefix.toUpperCase();

    if (!typed || typed.length === 0) {
      // Tampilkan prefix server saja
      el.innerHTML = `<span class="pfx-required">${prefix}</span><span class="pfx-cursor">_</span>`;
      el.className = 'prefix-value';
      if (hintEl) hintEl.textContent = `Awali kata dengan "${prefix}"...`;
      return;
    }

    const t = typed.toUpperCase();
    const pLower = serverPrefix.toLowerCase();
    const tLower = typed.toLowerCase();

    // Cek apakah ketikan sudah sesuai prefix
    if (tLower.startsWith(pLower)) {
      // Prefix oke, tunjukkan full ketikan dengan warna berbeda untuk bagian tambahan
      const matchPart = t.slice(0, prefix.length);
      const extraPart = t.slice(prefix.length);
      el.innerHTML = `<span class="pfx-matched">${matchPart}</span><span class="pfx-extra">${extraPart}</span><span class="pfx-cursor">_</span>`;
      el.className = 'prefix-value pfx-ok';
      if (hintEl) hintEl.textContent = extraPart.length > 0 ? `Terus tambahin huruf...` : `Tambahin huruf lagi!`;
    } else if (pLower.startsWith(tLower)) {
      // Sedang mengetik prefix (belum lengkap)
      const typedPart = t;
      const remainPart = prefix.slice(t.length);
      el.innerHTML = `<span class="pfx-typing">${typedPart}</span><span class="pfx-remain">${remainPart}</span><span class="pfx-cursor">_</span>`;
      el.className = 'prefix-value pfx-typing';
      if (hintEl) hintEl.textContent = `Lanjut ketik "${prefix}"...`;
    } else {
      // Salah prefix
      el.innerHTML = `<span class="pfx-wrong">${t}</span><span class="pfx-cursor">_</span>`;
      el.className = 'prefix-value pfx-error';
      if (hintEl) hintEl.textContent = `⚠️ Harus dimulai "${prefix}"!`;
    }
  },

  // Update prefix dari server (tidak ada ketikan)
  updatePrefix(prefix) {
    this._currentPrefix = prefix || '';
    this.updatePrefixDisplay(prefix, '');
  },

  // ─── TIMER ───
  updateTimer(timeLeft, totalTime) {
    const total = totalTime || 10;
    const bar = document.getElementById('timer-bar-fill');
    const num = document.getElementById('timer-number');
    if (!bar || !num) return;
    const pct = (timeLeft / total) * 100;
    bar.style.width = `${pct}%`;
    num.textContent = timeLeft;
    bar.className = 'timer-bar-fill';
    num.className = 'timer-number';
    if (timeLeft <= 3) { bar.classList.add('danger'); num.classList.add('danger'); }
    else if (timeLeft <= 6) { bar.classList.add('warning'); num.classList.add('warning'); }
  },

  // ─── WORD CHIP ───
  addWordChip(word, isBonus) {
    const history = document.getElementById('word-history');
    if (!history) return;
    const chip = document.createElement('div');
    chip.className = `word-chip${isBonus ? ' bonus' : ''}`;
    chip.textContent = word.toLowerCase();
    history.insertBefore(chip, history.firstChild);
    while (history.children.length > 25) history.removeChild(history.lastChild);
    State.totalWordsInGame++;
    const badge = document.getElementById('word-count-badge');
    if (badge) badge.textContent = `${State.totalWordsInGame} kata`;
  },

  // ─── INPUT STATE ───
  setInputEnabled(enabled) {
    const input = document.getElementById('word-input');
    const btn = document.getElementById('submit-btn');
    if (input) {
      input.disabled = !enabled;
      if (enabled) { input.focus(); input.value = ''; }
    }
    if (btn) btn.disabled = !enabled;
    // Reset prefix display saat giliran mulai
    if (enabled) this.updatePrefixDisplay(this._currentPrefix, '');
  },

  shakeInput() {
    const input = document.getElementById('word-input');
    if (!input) return;
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
  },

  flashScreen(type) {
    const flash = document.getElementById('feedback-flash');
    if (!flash) return;
    flash.className = `feedback-flash flash-${type}`;
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.opacity = '0'; }, 250);
  },

  // ─── STREAK POPUP ───
  showStreakPopup(streak, pts) {
    const popup = document.getElementById('streak-popup');
    if (!popup) return;
    popup.innerHTML = `<div>🔥 STREAK x${streak}!</div><div style="font-size:0.6em;margin-top:4px">+${pts} POIN BONUS!</div>`;
    popup.classList.remove('hidden');
    popup.style.animation = 'none';
    requestAnimationFrame(() => {
      popup.style.animation = 'streak-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    });
    setTimeout(() => { popup.classList.add('hidden'); }, 2200);
  },

  // ─── POWER UP POPUP ───
  showPowerupPopup(text, emoji) {
    const popup = document.getElementById('powerup-popup');
    if (!popup) return;
    popup.innerHTML = `<div>${emoji}</div><div style="font-size:0.55em;margin-top:2px">${text}</div>`;
    popup.classList.remove('hidden');
    popup.style.animation = 'none';
    requestAnimationFrame(() => { popup.style.animation = 'streak-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)'; });
    setTimeout(() => { popup.classList.add('hidden'); }, 2000);
  },

  // ─── CONFETTI ───
  showConfetti(container) {
    const colors = ['#00d4ff','#ffcc00','#00ff88','#ff2244','#ff8800','#aa44ff'];
    for (let i = 0; i < 50; i++) {
      const c = document.createElement('div');
      c.className = 'confetti-piece';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = `${0.7 + Math.random() * 1.3}s`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      const size = `${5 + Math.random() * 10}px`;
      c.style.width = size; c.style.height = size;
      container.appendChild(c);
    }
    setTimeout(() => { container.innerHTML = ''; }, 3000);
  },

  // ─── GAME OVER ───
  renderGameOver(data, myId) {
    const card = document.getElementById('gameover-card');
    const icon = document.getElementById('gameover-icon');
    const title = document.getElementById('gameover-title');
    const winnerName = document.getElementById('gameover-winner-name');
    const list = document.getElementById('rankings-list');
    const hint = document.getElementById('play-again-hint');
    const playAgainBtn = document.getElementById('play-again-btn');
    const statsBar = document.getElementById('stats-bar');
    const confettiEl = document.getElementById('gameover-confetti');

    const isWinner = data.winner && data.winner.id === myId;
    if (card) card.className = `gameover-card ${isWinner ? 'win' : 'lose'}`;
    if (icon) icon.textContent = isWinner ? '🏆' : '💀';
    if (title) title.textContent = isWinner ? 'WINNER!' : 'GAME OVER';
    if (winnerName) winnerName.textContent = data.winner ? `🥇 ${data.winner.name} MENANG!` : 'SERI!';
    if (isWinner && confettiEl) this.showConfetti(confettiEl);

    if (statsBar) {
      const me = data.rankings.find(r => r.id === myId);
      if (me) {
        const livesLeft = '❤️'.repeat(me.lives || 0) || '💀';
        statsBar.innerHTML = `
          <div class="stat-chip">📝 ${me.wordsCount} kata</div>
          <div class="stat-chip">${livesLeft} ${me.lives || 0} nyawa</div>
          <div class="stat-chip">🌐 ${data.totalWords || 0} total kata</div>
          <div class="stat-chip">${isWinner ? '🏆 JUARA!' : `#${me.rank}`}</div>
        `;
      }
    }

    if (playAgainBtn) {
      playAgainBtn.textContent = 'MAIN LAGI 🔄';
      playAgainBtn.disabled = false;
      if (hint) hint.textContent = State.isHost() ? 'Kamu host — klik untuk balik ke lobby!' : 'Nunggu host mulai lagi...';
    }

    if (list) {
      const medals = ['🥇','🥈','🥉'];
      list.innerHTML = data.rankings.map(p => {
        const livesHtml = p.eliminated
          ? `<span class="rank-lives eliminated">💀</span>`
          : `<span class="rank-lives">❤️ ${p.lives}</span>`;
        return `
          <div class="ranking-item rank-${p.rank}">
            <span class="rank-number">${medals[p.rank - 1] || `#${p.rank}`}</span>
            <span class="rank-name">${p.name}${p.id === myId ? ' (kamu)' : ''}</span>
            ${livesHtml}
            <span class="rank-words">${p.wordsCount} kata</span>
          </div>
        `;
      }).join('');
    }
  },

  // ─── OPPONENT TYPING (realtime) ───
  _typingTimer: null,
  showOpponentTyping(playerName, text) {
    const el = document.getElementById('opponent-typing');
    if (!el) return;
    el.textContent = text
      ? `⌨️ ${playerName} mengetik: ${text.toUpperCase()}_`
      : '';
    el.style.opacity = '1';
    if (this._typingTimer) clearTimeout(this._typingTimer);
    // Auto-hide setelah 3 detik tidak ada update
    this._typingTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { if (el) el.textContent = ''; }, 300);
    }, 3000);
  },

  clearOpponentTyping() {
    const el = document.getElementById('opponent-typing');
    if (el) { el.textContent = ''; el.style.opacity = '0'; }
    if (this._typingTimer) { clearTimeout(this._typingTimer); this._typingTimer = null; }
  },

  // ─── PAUSE OVERLAY ───
  showPauseOverlay(playerName, reason, autoResume = false) {
    let existing = document.getElementById('pause-overlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'pause-overlay';
      document.body.appendChild(existing);
    }
    const isDisconnect = reason === 'disconnect';
    const msgText = isDisconnect
      ? `${playerName} putus koneksi`
      : `${playerName} mem-pause game`;

    // autoResume = disconnect dengan ≥3 player → cukup notif, lanjut otomatis
    // !autoResume + disconnect = 2 player → tampilkan info saja (server akan game over)
    // manual = pause sengaja → tampilkan tombol lanjut
    let bottomContent;
    if (autoResume) {
      bottomContent = `<div class="pause-sub-auto">⏳ Melanjutkan otomatis...</div>`;
    } else if (!isDisconnect) {
      bottomContent = `<button class="pause-resume-btn" id="pause-resume-btn">▶ LANJUT</button>`;
    } else {
      bottomContent = `<div class="pause-sub">Memproses...</div>`;
    }

    existing.innerHTML = `
      <div class="pause-box">
        <div class="pause-icon">${isDisconnect ? '⚡' : '⏸'}</div>
        <div class="pause-title">${autoResume ? 'PLAYER KELUAR' : 'GAME PAUSE'}</div>
        <div class="pause-msg">${msgText}</div>
        ${bottomContent}
      </div>
    `;
    existing.classList.remove('hidden');

    // Wire resume button (manual pause only)
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
      if (window._socketHandler) window._socketHandler.resumeGame();
    });
  },

  hidePauseOverlay() {
    const el = document.getElementById('pause-overlay');
    if (el) el.classList.add('hidden');
  },
};
