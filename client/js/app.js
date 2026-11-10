// client/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  // ── LOADING SCREEN ──
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar    = document.getElementById('loading-bar-fill');
  const loadingText   = document.getElementById('loading-text');
  const loadingLogo   = document.getElementById('loading-logo');

  // Semua elemen mulai transparan
  loadingLogo.style.opacity  = '0';
  loadingLogo.style.filter   = 'drop-shadow(0 0 0px rgba(0,212,255,0))';
  loadingText.style.opacity  = '0';
  loadingBar.closest('.loading-bar-wrap').style.opacity = '0';
  loadingBar.style.width     = '0%';

  // Logo fade in (200ms delay)
  setTimeout(() => {
    loadingLogo.style.transition = 'opacity 0.9s ease, filter 0.9s ease';
    loadingLogo.style.opacity    = '1';
    loadingLogo.style.filter     = 'drop-shadow(0 0 28px rgba(0,212,255,0.6))';
  }, 200);

  // Bar + teks muncul setelah logo stabil
  setTimeout(() => {
    const wrap = loadingBar.closest('.loading-bar-wrap');
    wrap.style.transition         = 'opacity 0.5s ease';
    wrap.style.opacity            = '1';
    loadingText.style.transition  = 'opacity 0.5s ease';
    loadingText.style.opacity     = '1';
    loadingBar.style.transition   = 'width 0.4s ease';
  }, 1000);

  // Progress steps
  const steps = [
    { pct: 20,  text: 'Memuat aset...' },
    { pct: 45,  text: 'Menyambungkan server...' },
    { pct: 70,  text: 'Memuat kamus...' },
    { pct: 90,  text: 'Hampir siap...' },
    { pct: 100, text: 'Siap main! 🎮' },
  ];
  let idx = 0;
  const barInterval = setInterval(() => {
    if (idx < steps.length) {
      const s = steps[idx++];
      loadingBar.style.width    = s.pct + '%';
      loadingText.textContent   = s.text;
    } else {
      clearInterval(barInterval);
      // Semua elemen TIDAK punya transition/animation sendiri
      // jadi saat screen fade out, semua hilang bareng
      loadingScreen.style.transition = 'opacity 0.7s ease, visibility 0.7s ease';
      setTimeout(() => loadingScreen.classList.add('hidden'), 300);
    }
  }, 430);



  UI.init();
  Toast.init();
  createParticles();

  const socket = window._ioConnect ? window._ioConnect() : io();
  SocketHandler.init(socket);
  window._socketHandler = SocketHandler;

  history.replaceState({ screen: 'landing' }, '');

  // ─── LANDING ───
  const nameInput = document.getElementById('name-input');
  const validationMsg = document.getElementById('validation-msg');

  function validateName() {
    const val = nameInput.value.trim();
    if (val.length === 0) {
      validationMsg.textContent = '';
      validationMsg.className = 'validation-msg';
      nameInput.className = 'neon-input';
      return false;
    }
    if (val.length < 3) {
      validationMsg.textContent = 'Nama minimal 3 karakter ya!';
      validationMsg.className = 'validation-msg error';
      nameInput.className = 'neon-input error';
      return false;
    }
    if (val.length > 12) {
      validationMsg.textContent = 'Maksimal 12 karakter aja!';
      validationMsg.className = 'validation-msg error';
      nameInput.className = 'neon-input error';
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(val)) {
      validationMsg.textContent = 'Huruf dan angka doang ya!';
      validationMsg.className = 'validation-msg error';
      nameInput.className = 'neon-input error';
      return false;
    }
    validationMsg.textContent = '✓ Siap main!';
    validationMsg.className = 'validation-msg success';
    nameInput.className = 'neon-input';
    return true;
  }

  nameInput.addEventListener('input', validateName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && validateName()) showJoinModal();
  });

  document.getElementById('create-btn').addEventListener('click', () => {
    if (!validateName()) { nameInput.focus(); Toast.error('Isi nama dulu dong!'); return; }
    State.myName = nameInput.value.trim();
    SocketHandler.createRoom(State.myName);
  });

  document.getElementById('join-btn').addEventListener('click', () => {
    if (!validateName()) { nameInput.focus(); Toast.error('Isi nama dulu dong!'); return; }
    State.myName = nameInput.value.trim();
    showJoinModal();
  });

  // ─── JOIN MODAL ───
  const joinModal = document.getElementById('join-modal');
  const codeInput = document.getElementById('room-code-input');
  const confirmJoinBtn = document.getElementById('confirm-join-btn');

  function showJoinModal() {
    joinModal.classList.remove('hidden');
    codeInput.value = '';
    setTimeout(() => codeInput.focus(), 50);
  }
  function hideJoinModal() { joinModal.classList.add('hidden'); }

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-WYZ0-9]/g, '');
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmJoinBtn.click();
    if (e.key === 'Escape') hideJoinModal();
  });
  confirmJoinBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code || code.length < 4) { Toast.error('Kode room gak valid!'); return; }
    SocketHandler.joinRoom(State.myName, code);
    hideJoinModal();
  });
  document.getElementById('cancel-join-btn').addEventListener('click', hideJoinModal);
  joinModal.addEventListener('click', (e) => { if (e.target === joinModal) hideJoinModal(); });

  // ─── LOBBY ───
  document.getElementById('start-btn').addEventListener('click', () => SocketHandler.startGame());
  document.getElementById('lobby-room-code').addEventListener('click', () => {
    const code = document.getElementById('lobby-room-code').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => Toast.success('Kode disalin! Bagiin ke temenmu 🔗')).catch(() => Toast.info(`Kode: ${code}`));
    } else { Toast.info(`Kode room: ${code}`); }
  });

  // ─── GAME INPUT ───
  const wordInput = document.getElementById('word-input');

  // ── REALTIME PREFIX DISPLAY + BROADCAST TYPING ──
  let _typingTimeout = null;
  wordInput.addEventListener('input', () => {
    if (!State.isMyTurn) return;
    const typed = wordInput.value.toLowerCase().trim();
    UI.updatePrefixDisplay(State.currentPrefix, typed);
    // Broadcast ke semua player lain
    if (_typingTimeout) clearTimeout(_typingTimeout);
    _typingTimeout = setTimeout(() => {
      SocketHandler.socket.emit('player_typing', { text: typed });
    }, 50); // debounce 50ms
  });

  function submitWord() {
    const word = wordInput.value.trim().toLowerCase();
    if (!word) return;
    if (!State.isMyTurn) { Toast.warning('Tunggu giliran kamu dulu!'); return; }
    // Client-side: cek huruf X
    if (word.includes('x')) {
      Toast.error('Kata dengan huruf X dilarang! 🚫');
      UI.shakeInput();
      return;
    }
    // Client-side: cek prefix
    if (State.currentPrefix && !word.startsWith(State.currentPrefix.toLowerCase())) {
      Toast.error(`Harus diawali "${State.currentPrefix.toUpperCase()}" ya!`);
      UI.shakeInput();
      UI.updatePrefixDisplay(State.currentPrefix, word);
      return;
    }
    SocketHandler.submitWord(word);
    wordInput.value = '';
    UI.updatePrefixDisplay(State.currentPrefix, '');
  }

  document.getElementById('submit-btn').addEventListener('click', submitWord);
  wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitWord(); });

  // Tombol exit di game
  document.getElementById('exit-game-btn').addEventListener('click', () => {
    showLeaveConfirm();
    history.pushState({ screen: 'game' }, '');
  });

  // Tombol pause manual di game
  document.getElementById('pause-game-btn').addEventListener('click', () => {
    const room = State.room;
    if (!room) return;
    if (room.status === 'paused') {
      // Kalau sudah pause → resume
      socket.emit('resume_game');
    } else if (room.status === 'playing') {
      socket.emit('pause_game');
    }
  });

  // ─── GAME OVER ───
  document.getElementById('play-again-btn').addEventListener('click', () => {
    if (State.isHost()) { socket.emit('play_again'); }
    else { Toast.info('Nunggu host buat mulai lagi...'); }
  });
  document.getElementById('exit-btn').addEventListener('click', () => goToLanding());

  // ─── LEAVE MODAL ───
  document.getElementById('confirm-leave-btn').addEventListener('click', () => {
    hideLeaveConfirm();
    goToLanding();
  });
  document.getElementById('cancel-leave-btn').addEventListener('click', () => {
    hideLeaveConfirm();
    history.pushState({ screen: 'game' }, '');
  });

  function showLeaveConfirm() { document.getElementById('leave-modal').classList.remove('hidden'); }
  function hideLeaveConfirm() { document.getElementById('leave-modal').classList.add('hidden'); }

  // ─── POPSTATE ───
  window.addEventListener('popstate', (e) => {
    const screen = e.state?.screen || 'landing';
    hideJoinModal();
    hideLeaveConfirm();
    if (screen === 'landing') {
      const current = getCurrentScreen();
      if (current === 'game') {
        showLeaveConfirm();
        history.pushState({ screen: 'game' }, '');
      } else if (current === 'lobby') {
        goToLanding(false);
      } else if (current === 'gameover') {
        goToLanding(false);
      }
    }
  });

  function getCurrentScreen() {
    for (const s of ['landing','lobby','game','gameover']) {
      const el = document.getElementById(`${s}-screen`);
      if (el && !el.classList.contains('hidden')) return s;
    }
    return 'landing';
  }

  function goToLanding(pushHistory = true) {
    socket.emit(GAME_CONFIG.EVENTS.LEAVE_ROOM);
    State.reset();
    UI.showScreen('landing');
    if (pushHistory) history.pushState({ screen: 'landing' }, '');
  }

  window._navigateTo = (screen) => { history.pushState({ screen }, ''); };
});

// ─── PARTICLES ───
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.setProperty('--duration', `${8 + Math.random() * 12}s`);
    p.style.setProperty('--delay', `${Math.random() * 8}s`);
    p.style.setProperty('--size', `${1 + Math.random() * 2}px`);
    container.appendChild(p);
  }
}
