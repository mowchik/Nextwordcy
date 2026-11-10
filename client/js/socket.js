// client/js/socket.js
const SocketHandler = {
  socket: null,

  init(socket) {
    this.socket = socket;
    this.registerEvents();
  },

  registerEvents() {
    const s = this.socket;
    let _wasConnectedBefore = false;

    s.on('connect', () => {
      State.myId = s.id;
    });

    s.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') Toast.warning('Koneksi putus, lagi nyambungin...');
    });

    s.on('reconnect_failed', () => Toast.error('Gagal nyambung. Coba refresh dulu!'));

    s.on('player_typing', (data) => {
      UI.showOpponentTyping(data.playerName, data.text);
    });

    // ─── ROOM EVENTS ───
    s.on(GAME_CONFIG.EVENTS.ROOM_CREATED, (data) => {
      State.myId = data.yourId;
      State.setRoom(data.room);
      UI.showScreen('lobby');
      UI.renderLobby(data.room, State.myId);
      Toast.success(`Room ${data.room.code} siap! Ajak temenmu 🎉`);
      if (window._navigateTo) window._navigateTo('lobby');
    });

    s.on(GAME_CONFIG.EVENTS.ROOM_JOINED, (data) => {
      State.myId = data.yourId;
      State.setRoom(data.room);
      UI.showScreen('lobby');
      UI.renderLobby(data.room, State.myId);
      Toast.success('Masuk room! 🙌');
      if (window._navigateTo) window._navigateTo('lobby');
    });

    s.on(GAME_CONFIG.EVENTS.ROOM_UPDATED, (data) => {
      State.setRoom(data.room);
      if (data.message) Toast.info(data.message);
      const lobbyVisible = !document.getElementById('lobby-screen').classList.contains('hidden');
      const gameVisible = !document.getElementById('game-screen').classList.contains('hidden');
      if (lobbyVisible) UI.renderLobby(data.room, State.myId);
      else if (gameVisible) {
        const cp = getCurrentActivePlayerId(data.room);
        UI.renderPlayers(data.room.players, cp, State.myId);
      }
    });

    s.on(GAME_CONFIG.EVENTS.HOST_CHANGED, (data) => {
      if (data.newHostId === State.myId) Toast.info('Kamu jadi HOST sekarang! 👑');
      else Toast.info(`${data.newHostName} jadi HOST baru`);
      if (State.room) {
        State.room.hostId = data.newHostId;
        State.room.players.forEach(p => { p.isHost = p.id === data.newHostId; });
      }
      const lobbyVisible = !document.getElementById('lobby-screen').classList.contains('hidden');
      if (lobbyVisible) UI.renderLobby(State.room, State.myId);
    });

    s.on(GAME_CONFIG.EVENTS.PLAYER_LEFT, (data) => {
      State.setRoom(data.room);
      Toast.warning(`⚡ ${data.playerName} keluar dari game`);
      const lobbyVisible = !document.getElementById('lobby-screen').classList.contains('hidden');
      const gameVisible = !document.getElementById('game-screen').classList.contains('hidden');
      if (lobbyVisible) UI.renderLobby(data.room, State.myId);
      else if (gameVisible) {
        const cp = getCurrentActivePlayerId(data.room);
        UI.renderPlayers(data.room.players, cp, State.myId);
      }
    });

    s.on('room_reset', (data) => {
      State.setRoom(data.room);
      State.isMyTurn = false;
      State.currentPrefix = null;
      State.totalWordsInGame = 0;
      const histEl = document.getElementById('word-history');
      if (histEl) histEl.innerHTML = '';
      const badge = document.getElementById('word-count-badge');
      if (badge) badge.textContent = '0 kata';
      UI.updatePrefix('');
      UI.showScreen('lobby');
      UI.renderLobby(data.room, State.myId);
      Toast.info(data.message || 'Balik ke lobby! 🎮');
      if (window._navigateTo) window._navigateTo('lobby');
    });

    s.on('left_room', () => {
      State.reset();
      UI.showScreen('landing');
    });

    // ─── GAME EVENTS ───
    s.on(GAME_CONFIG.EVENTS.GAME_STARTED, (data) => {
      const pb = document.getElementById('pause-game-btn');
      if (pb) { pb.classList.remove('is-paused'); pb.classList.add('is-playing'); }
      State.setRoom(data.room);
      State.isMyTurn = false;
      State.totalWordsInGame = 0;
      const histEl = document.getElementById('word-history');
      if (histEl) histEl.innerHTML = '';
      const badge = document.getElementById('word-count-badge');
      if (badge) badge.textContent = '0 kata';
      const rcEl = document.getElementById('game-room-code');
      if (rcEl) rcEl.textContent = `ROOM: ${data.room.code}`;
      UI.showScreen('game');
      Toast.info('Game mulai! Siapin dirimu 💥');
      UI.setInputEnabled(false);
      if (window._navigateTo) window._navigateTo('game');
    });

    s.on(GAME_CONFIG.EVENTS.TURN_START, (data) => {
      State.setRoom(data.room);
      State.currentPrefix = data.prefix;
      State.isMyTurn = data.currentPlayerId === State.myId;
      State.timeLeft = data.timeLeft;
      UI.updatePrefix(data.prefix);
      UI.updateTimer(data.timeLeft, GAME_CONFIG.TURN_TIME);
      UI.renderPlayers(data.room.players, data.currentPlayerId, State.myId);
      UI.setInputEnabled(State.isMyTurn);
      UI.clearOpponentTyping();
      const roundInfo = document.getElementById('game-round-info');
      if (roundInfo) roundInfo.textContent = `${State.totalWordsInGame} kata terpakai`;
      if (State.isMyTurn) Toast.info(`Giliran kamu! Awali dengan "${(data.prefix || '').toUpperCase()}" 🎯`);
      else Toast.info(`Giliran ${data.currentPlayerName}... ⏳`);
    });

    s.on(GAME_CONFIG.EVENTS.TIMER_TICK, (data) => {
      State.timeLeft = data.timeLeft;
      UI.updateTimer(data.timeLeft, GAME_CONFIG.TURN_TIME);
    });

    s.on(GAME_CONFIG.EVENTS.WORD_ACCEPTED, (data) => {
      State.setRoom(data.room);
      UI.addWordChip(data.word, data.isStreakBonus);
      State.currentPrefix = data.newPrefix;
      UI.updatePrefix(data.newPrefix);
      UI.setInputEnabled(false);
      UI.flashScreen('green');

      Toast.success(`✅ "${data.word}" — lanjut: ${(data.newPrefix||'').toUpperCase()}`);

      const roundInfo = document.getElementById('game-round-info');
      if (roundInfo) roundInfo.textContent = `${State.totalWordsInGame} kata terpakai`;
    });

    s.on(GAME_CONFIG.EVENTS.WORD_REJECTED, (data) => {
      const isMe = data.playerId === State.myId;

      if (data.fatal) {
        UI.flashScreen('red');
        UI.renderPlayers(
          data.room ? data.room.players : (State.room ? State.room.players : []),
          null, State.myId
        );
        if (data.room) State.setRoom(data.room);
      } else {
        UI.shakeInput();
      }

      if (data.reason === 'TIMEOUT') {
        Toast.error(isMe ? '⏰ Habis waktunya! -1 nyawa 😬' : `⏰ ${data.playerName} kehabisan waktu!`);
      } else if (data.reason === 'TOO_SHORT') {
        if (isMe) Toast.warning(`Kata terlalu pendek! Minimal 3 huruf.`);
      } else if (data.reason === 'BANNED_LETTER') {
        if (isMe) Toast.warning('Huruf X dilarang! 🚫 Coba kata lain.');
      } else if (data.reason === 'WRONG_PREFIX') {
        if (isMe) Toast.warning(`Harus dimulai "${(State.currentPrefix||'').toUpperCase()}"!`);
      } else if (data.reason === 'USED_WORD') {
        if (isMe) Toast.warning(`⚠️ ${data.message}`);
      } else {
        if (isMe) Toast.error(`❌ ${data.message}${data.fatal ? ' — giliran berakhir!' : ' — coba lagi!'}`);
      }

      // Update lives di UI
      if (isMe && State.room) {
        const me = State.room.players.find(p => p.id === State.myId);
        if (me && data.lives !== undefined) me.lives = data.lives;
        const cp = getCurrentActivePlayerId(State.room);
        UI.renderPlayers(State.room.players, cp, State.myId);
      }

      if (data.fatal && isMe) {
        UI.setInputEnabled(false);
      }
    });

    s.on(GAME_CONFIG.EVENTS.PLAYER_ELIMINATED, (data) => {
      const isMe = data.playerId === State.myId;
      UI.flashScreen('red');
      Toast.warning(isMe ? '💀 Kamu tereliminasi! Tonton sisa pertandingan...' : `💀 ${data.playerName} tereliminasi!`);
      if (isMe) UI.setInputEnabled(false);
    });

    s.on(GAME_CONFIG.EVENTS.GAME_OVER, (data) => {
      UI.setInputEnabled(false);
      UI.renderGameOver(data, State.myId);
      setTimeout(() => {
        UI.showScreen('gameover');
        if (window._navigateTo) window._navigateTo('gameover');
      }, 600);
    });

    s.on('game_paused', (data) => {
      UI.setInputEnabled(false);
      const isDisconnect = data.reason === 'disconnect';
      UI.showPauseOverlay(data.playerName, data.reason, data.autoResume || false);
      if (isDisconnect) Toast.warning(`⚡ ${data.playerName} putus koneksi — game di-pause!`);
      else Toast.info(`⏸ ${data.playerName} mem-pause game`);
      if (data.room) State.setRoom(data.room);
      // Update pause btn icon
      const pauseBtn = document.getElementById('pause-game-btn');
      if (pauseBtn) { pauseBtn.classList.remove('is-playing'); pauseBtn.classList.add('is-paused'); }
    });

    s.on('game_resumed', (data) => {
      UI.hidePauseOverlay();
      if (data.room) State.setRoom(data.room);
      Toast.success(data.message || 'Game lanjut! ▶️');
      // Restore pause btn icon
      const pauseBtn = document.getElementById('pause-game-btn');
      if (pauseBtn) { pauseBtn.classList.remove('is-paused'); pauseBtn.classList.add('is-playing'); }
    });

    s.on(GAME_CONFIG.EVENTS.ERROR, (data) => {
      Toast.error(data.message || 'Ada yang error nih!');
    });
  },

  createRoom(name) { this.socket.emit(GAME_CONFIG.EVENTS.CREATE_ROOM, { name }); },
  joinRoom(name, code) { this.socket.emit(GAME_CONFIG.EVENTS.JOIN_ROOM, { name, code }); },
  startGame() { this.socket.emit(GAME_CONFIG.EVENTS.START_GAME); },
  submitWord(word) { this.socket.emit(GAME_CONFIG.EVENTS.SUBMIT_WORD, { word }); },
  pauseGame() { this.socket.emit('pause_game'); },
  resumeGame() { this.socket.emit('resume_game'); },
};

function getCurrentActivePlayerId(room) {
  const active = room.players.filter(p => !p.eliminated);
  if (!active.length) return null;
  return active[room.turnIndex % active.length]?.id;
}
