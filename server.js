// server.js - NextWord Game Server v4.0 (Pause Overhaul)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// ─── CONFIG ───
const GAME_CONFIG = {
  MAX_PLAYERS: 5,
  MIN_PLAYERS: 2,
  TURN_TIME: 10,
  STARTING_LIVES: 3,
  MIN_WORD_LENGTH: 3,
};

const EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_UPDATED: 'room_updated',
  PLAYER_LEFT: 'player_left',
  HOST_CHANGED: 'host_changed',
  START_GAME: 'start_game',
  GAME_STARTED: 'game_started',
  TURN_START: 'turn_start',
  TIMER_TICK: 'timer_tick',
  SUBMIT_WORD: 'submit_word',
  WORD_ACCEPTED: 'word_accepted',
  WORD_REJECTED: 'word_rejected',
  WORD_WRONG_FATAL: 'word_wrong_fatal',
  PLAYER_ELIMINATED: 'player_eliminated',
  GAME_OVER: 'game_over',
  LEAVE_ROOM: 'leave_room',
  ERROR: 'error',
};

// ─── KAMUS BAHASA INDONESIA ───
function loadKamus() {
  const kamusPath = path.join(__dirname, 'kamus.txt');
  try {
    const raw = fs.readFileSync(kamusPath, 'utf-8');
    const words = raw
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 3 && /^[a-z]+$/.test(w) && !w.includes('x'));
    console.log(`📚 Kamus dimuat: ${words.length} kata dari kamus.txt`);
    return new Set(words);
  } catch (err) {
    console.warn('⚠️  kamus.txt tidak ditemukan, pakai kamus bawaan minimal.');
    return new Set([
      'ada','adalah','adik','adu','air','ajak','ajar','ajaran','aku','akhir','akar','aksi','alam',
      'alat','alur','ambil','aman','amat','anak','angin','antara','api','asa','asal','asik',
      'asli','atas','atur','awal','awas','ayah','ayam','ayun',
      'bagi','bagus','baik','bakar','bakat','baling','bantu','bantuan','baru','bata','batu','bawa',
      'bayar','bebas','beda','belajar','belum','berani','berat','bersama','besar','biar','bias','biasa',
      'bicara','bisa','bola','boleh','buat','buah','bukan','buku','bulan','bumi','bunga',
      'cahaya','cantik','cara','cepat','cerita','cinta','coba','cocok','cukup','cuma',
      'dalam','dan','dapat','darah','dapur','dasar','datang','dari','dekat','dengar','dengan',
      'depan','deras','desa','diam','dingin','diri','duduk','dulu','dua',
      'enak','elok','emas','energi','fajar','fakta','fokus','foto',
      'gagah','gagal','gagas','gambar','garis','gatal','gaya','gelap','gelombang','gembira',
      'gerak','gigi','gigih','guna','guru','gunung',
      'hadap','hadir','hal','halus','hampir','hangat','harap','harum','hari','harus','hasil',
      'hati','hebat','hijau','hilang','hingga','hidup','hutan',
      'ibu','ikan','ikut','ilmu','indah','ingat','ingin','itu','izin',
      'jadi','jaga','jalan','jantan','janji','jauh','jawab','jatuh','jelas','jemput',
      'jenis','jiwa','juara','jagoan','juga','jumlah',
      'kalah','kalau','kali','kamu','kanan','kapal','karena','kasih','kata','kabar',
      'keras','kecil','kelas','kembali','kenapa','kepala','keren','kerja','ketika',
      'kiri','kita','kota','kuat','kulit','kuliah','kurang','kursi',
      'lahir','laju','lama','lambat','langit','langkah','lanjut','lari','latih',
      'laut','layak','lepas','letak','luar','lucu','luka',
      'maju','makan','malam','mana','manusia','masa','maaf','mata','mau','meski',
      'melawan','memang','menarik','menolong','meraih','mereka','minta','modal','mudah',
      'mulai','mulia','muncul','mungkin','murni','minum',
      'nada','nafas','naik','nama','negeri','niat','nilai','nyata','nyawa',
      'obat','olah','omong','orang',
      'paham','pagi','paksa','pandai','panjang','panas','pasrah','patah','pecah',
      'pejuang','penuh','percaya','perang','pernah','perlu','pesan','peta',
      'pikir','pilih','pintar','proses','puas','pulang','punya','putih','putus',
      'rahasia','raih','rajin','ramah','rantai','rakyat','rasa','rendah','rela',
      'riang','ribu','ribut','ringan','ruang','rumah','rusak',
      'sabar','sama','sampai','sangat','satu','segera','sejuk','sekolah','selamat',
      'selalu','semoga','semua','senyum','sering','setia','siap','simpan','sinar',
      'soal','sudah','suka','sukses','sungguh','suara','surga','sumber','susah',
      'tabah','tahun','takut','tanah','tangkap','tarik','tawa','tegah','tegak','teguh',
      'tekad','teman','tempat','tenang','tentang','terang','terima','terus','tidak',
      'tiap','timbul','tinggi','tulang','tulus','tugas',
      'udara','ulas','umum','ungkap','unik','untuk','usaha','utama',
      'visi','wajah','wajib','wajar','walau','warga','warna','waktu',
      'yang','yakin','zaman',
    ]);
  }
}

const VALID_WORDS = loadKamus();

console.log('🔧 Membangun prefix index...');
const prefixIndex = new Set();
for (const word of VALID_WORDS) {
  for (let i = 1; i <= word.length; i++) {
    prefixIndex.add(word.slice(0, i));
  }
}
console.log(`✅ Prefix index siap: ${prefixIndex.size} prefix unik`);

const VALID_START_SINGLES = ['a','b','c','d','e','f','g','h','i','j','k','l','m',
                              'n','o','p','r','s','t','u','w','y']
  .filter(p => prefixIndex.has(p));

function isValidWord(word) {
  const w = word.toLowerCase().trim();
  if (!w) return false;
  if (w.length < GAME_CONFIG.MIN_WORD_LENGTH) return false;
  if (w.includes('x')) return false;
  if (!/^[a-z]+$/.test(w)) return false;
  return VALID_WORDS.has(w);
}

function prefixHasWords(prefix) {
  return prefixIndex.has(prefix.toLowerCase());
}

function getNewPrefix(word) {
  const w = word.toLowerCase();
  if (w.length >= 7) {
    const p3 = w.slice(-3);
    if (prefixHasWords(p3)) return p3;
    const p2 = w.slice(-2);
    if (prefixHasWords(p2)) return p2;
    const p1 = w.slice(-1);
    if (prefixHasWords(p1)) return p1;
  } else if (w.length >= 4) {
    const p2 = w.slice(-2);
    if (prefixHasWords(p2)) return p2;
    const p1 = w.slice(-1);
    if (prefixHasWords(p1)) return p1;
  } else {
    const p1 = w.slice(-1);
    if (prefixHasWords(p1)) return p1;
  }
  return getStartPrefix();
}

function getStartPrefix() {
  const shuffled = [...VALID_START_SINGLES].sort(() => Math.random() - 0.5);
  return shuffled[0] || 'a';
}

// ─── ROOM STATE ───
const rooms = new Map();
const playerRoom = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWYZ';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateCode();
  const room = {
    code,
    hostId,
    status: 'waiting',
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      lives: GAME_CONFIG.STARTING_LIVES,
      wordsCount: 0,
      eliminated: false,
      streak: 0,
    }],
    usedWords: new Set(),
    currentPrefix: null,
    turnIndex: 0,
    timer: null,
    timeLeft: GAME_CONFIG.TURN_TIME,
    totalWords: 0,
    // Pause state
    pausedBy: null,       // socket id yang trigger pause
    pauseReason: null,    // 'disconnect' | 'manual'
    pausedPlayerName: null,
  };
  rooms.set(code, room);
  playerRoom.set(hostId, code);
  return room;
}

function getRoomSafe(room) {
  return {
    ...room,
    usedWords: [],
    timer: undefined,
  };
}

// ─── TURN LOGIC ───
function getActivePlayers(room) {
  return room.players.filter(p => !p.eliminated);
}

function getCurrentPlayer(room) {
  const active = getActivePlayers(room);
  if (active.length === 0) return null;
  return active[room.turnIndex % active.length];
}

function startTurn(io, room) {
  if (room.status !== 'playing') return;
  if (room.transitioning) return;
  clearTurnTimer(room);
  const current = getCurrentPlayer(room);
  if (!current) return checkGameOver(io, room);

  room.timeLeft = GAME_CONFIG.TURN_TIME;
  io.to(room.code).emit(EVENTS.TURN_START, {
    room: getRoomSafe(room),
    prefix: room.currentPrefix,
    currentPlayerId: current.id,
    currentPlayerName: current.name,
    timeLeft: room.timeLeft,
  });

  const timerId = setInterval(() => {
    if (room.timer !== timerId) { clearInterval(timerId); return; }
    if (room.status !== 'playing') { clearInterval(timerId); room.timer = null; return; }

    room.timeLeft--;
    io.to(room.code).emit(EVENTS.TIMER_TICK, { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      clearTurnTimer(room);
      handleTimeout(io, room, current);
    }
  }, 1000);
  room.timer = timerId;
}

function clearTurnTimer(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
}

function scheduleNextTurn(io, room, delay = 1500) {
  if (room.transitioning) return;
  room.transitioning = true;
  setTimeout(() => {
    room.transitioning = false;
    startTurn(io, room);
  }, delay);
}

function handleTimeout(io, room, player) {
  if (player.eliminated) {
    const active = getActivePlayers(room);
    if (active.length <= 1) return checkGameOver(io, room);
    room.turnIndex++;
    scheduleNextTurn(io, room, 1500);
    return;
  }

  player.lives--;
  player.streak = 0;
  io.to(room.code).emit(EVENTS.WORD_REJECTED, {
    playerId: player.id,
    playerName: player.name,
    reason: 'TIMEOUT',
    lives: player.lives,
    fatal: true,
    room: getRoomSafe(room),
  });

  if (player.lives <= 0) {
    player.eliminated = true;
    io.to(room.code).emit(EVENTS.PLAYER_ELIMINATED, {
      playerId: player.id,
      playerName: player.name,
    });
  }

  const active = getActivePlayers(room);
  if (active.length <= 1) return checkGameOver(io, room);
  room.turnIndex++;
  scheduleNextTurn(io, room, 1500);
}

function checkGameOver(io, room) {
  clearTurnTimer(room);
  room.transitioning = false;
  const active = getActivePlayers(room);
  room.status = 'ended';

  const winner = active.length === 1 ? active[0] : null;

  // Kalau ada pemenang, jadikan dia host baru (biar bisa play again)
  if (winner && room.hostId !== winner.id) {
    room.hostId = winner.id;
    winner.isHost = true;
    room.players.forEach(p => { if (p.id !== winner.id) p.isHost = false; });
    io.to(room.code).emit(EVENTS.HOST_CHANGED, {
      newHostId: winner.id,
      newHostName: winner.name,
    });
  }

  const sorted = [...room.players].sort((a, b) => {
    if (a.eliminated && !b.eliminated) return 1;
    if (!a.eliminated && b.eliminated) return -1;
    return b.lives - a.lives;
  });

  const rankings = sorted.map((p, i) => ({
    rank: i + 1,
    id: p.id,
    name: p.name,
    wordsCount: p.wordsCount,
    lives: p.lives,
    eliminated: p.eliminated,
  }));

  io.to(room.code).emit(EVENTS.GAME_OVER, {
    winner: winner ? { id: winner.id, name: winner.name } : null,
    rankings,
    totalWords: room.totalWords,
    reason: active.length === 0 ? 'all_disconnected' : 'normal',
  });
}

// ─── PAUSE HELPERS ───
function pauseGame(io, room, pausedById, pausedByName, reason) {
  clearTurnTimer(room);
  room.status = 'paused';
  room.pausedBy = pausedById;
  room.pauseReason = reason; // 'disconnect' | 'manual'
  room.pausedPlayerName = pausedByName;
  io.to(room.code).emit('game_paused', {
    reason,
    playerName: pausedByName,
    room: getRoomSafe(room),
  });
}

function resumeGame(io, room, resumedByName) {
  room.status = 'playing';
  room.pausedBy = null;
  room.pauseReason = null;
  room.pausedPlayerName = null;
  io.to(room.code).emit('game_resumed', {
    message: resumedByName ? `${resumedByName} lanjutin game! ▶️` : 'Game lanjut! ▶️',
    room: getRoomSafe(room),
  });
  scheduleNextTurn(io, room, 800);
}

// ─── HTTP SERVER ───
const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  let filePath;

  if (urlPath === '/shared/constants.js') {
    filePath = path.join(__dirname, 'shared', 'constants.js');
  } else if (urlPath === '/' || urlPath === '') {
    filePath = path.join(__dirname, 'client', 'index.html');
  } else {
    filePath = path.join(__dirname, 'client', urlPath);
  }

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

// ─── SOCKET.IO ───
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('[+] Connected:', socket.id);

  socket.on(EVENTS.CREATE_ROOM, ({ name }) => {
    if (!name || name.length < 2) return socket.emit(EVENTS.ERROR, { message: 'Nama gak valid nih!' });
    const existing = playerRoom.get(socket.id);
    if (existing) leaveRoom(socket, existing);
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    socket.emit(EVENTS.ROOM_CREATED, { yourId: socket.id, room: getRoomSafe(room) });
  });

  socket.on(EVENTS.JOIN_ROOM, ({ name, code }) => {
    if (!name || !code) return socket.emit(EVENTS.ERROR, { message: 'Data gak lengkap!' });
    const upperCode = code.toUpperCase();
    const room = rooms.get(upperCode);
    if (!room) return socket.emit(EVENTS.ERROR, { message: 'Room gak ketemu. Cek lagi kode-nya!' });
    if (room.status !== 'waiting') return socket.emit(EVENTS.ERROR, { message: 'Game udah jalan, gak bisa masuk!' });
    if (room.players.length >= GAME_CONFIG.MAX_PLAYERS) return socket.emit(EVENTS.ERROR, { message: 'Room penuh (5/5)!' });
    const nameTaken = room.players.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (nameTaken) return socket.emit(EVENTS.ERROR, { message: `Nama "${name}" udah dipakai di room ini! Pilih nama lain.` });
    const existing = playerRoom.get(socket.id);
    if (existing) leaveRoom(socket, existing);
    room.players.push({
      id: socket.id, name, isHost: false,
      lives: GAME_CONFIG.STARTING_LIVES, wordsCount: 0,
      eliminated: false, streak: 0,
    });
    playerRoom.set(socket.id, upperCode);
    socket.join(upperCode);
    socket.emit(EVENTS.ROOM_JOINED, { yourId: socket.id, room: getRoomSafe(room) });
    socket.to(upperCode).emit(EVENTS.ROOM_UPDATED, { room: getRoomSafe(room), message: `${name} baru aja gabung! 👋` });
  });

  socket.on(EVENTS.START_GAME, () => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit(EVENTS.ERROR, { message: 'Cuma host yang bisa mulai!' });
    if (room.players.length < GAME_CONFIG.MIN_PLAYERS) return socket.emit(EVENTS.ERROR, { message: 'Butuh minimal 2 pemain!' });
    if (room.status !== 'waiting') return;

    room.status = 'playing';
    room.transitioning = false;
    room.usedWords = new Set();
    room.turnIndex = 0;
    room.currentPrefix = getStartPrefix();
    room.totalWords = 0;
    room.pausedBy = null;
    room.pauseReason = null;
    room.pausedPlayerName = null;
    room.players.forEach(p => {
      p.lives = GAME_CONFIG.STARTING_LIVES;
      p.wordsCount = 0;
      p.eliminated = false;
      p.streak = 0;
    });

    io.to(code).emit(EVENTS.GAME_STARTED, { room: getRoomSafe(room) });
    scheduleNextTurn(io, room, 1200);
  });

  socket.on(EVENTS.SUBMIT_WORD, ({ word }) => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const current = getCurrentPlayer(room);
    if (!current || current.id !== socket.id) {
      return socket.emit(EVENTS.ERROR, { message: 'Bukan giliran kamu!' });
    }

    const w = (word || '').toLowerCase().trim();

    if (w.length < GAME_CONFIG.MIN_WORD_LENGTH) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: `Kata minimal ${GAME_CONFIG.MIN_WORD_LENGTH} huruf ya!`,
        lives: current.lives, fatal: false, reason: 'TOO_SHORT',
      });
    }

    if (w.includes('x')) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: 'Kata dengan huruf X dilarang! 🚫 Coba lagi.',
        lives: current.lives, fatal: false, reason: 'BANNED_LETTER',
      });
    }

    if (!/^[a-z]+$/.test(w)) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: 'Hanya huruf a-z ya!',
        lives: current.lives, fatal: false, reason: 'INVALID_CHARS',
      });
    }

    if (!w.startsWith(room.currentPrefix.toLowerCase())) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: `Harus awali dengan "${room.currentPrefix.toUpperCase()}" ya!`,
        lives: current.lives, fatal: false, reason: 'WRONG_PREFIX',
      });
    }

    if (room.usedWords.has(w)) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: `"${w}" udah pernah dipakai! Coba kata lain.`,
        lives: current.lives, fatal: false, reason: 'USED_WORD',
      });
    }

    if (!isValidWord(w)) {
      return socket.emit(EVENTS.WORD_REJECTED, {
        playerId: socket.id, playerName: current.name,
        message: `"${w}" gak ada di kamus! Coba kata lain.`,
        lives: current.lives, fatal: false, reason: 'INVALID_WORD',
      });
    }

    // ─── KATA DITERIMA ───
    clearTurnTimer(room);
    room.usedWords.add(w);
    current.wordsCount++;
    current.streak++;
    room.totalWords++;

    const newPrefix = getNewPrefix(w);
    room.currentPrefix = newPrefix;
    room.turnIndex++;

    io.to(code).emit(EVENTS.WORD_ACCEPTED, {
      word: w, newPrefix,
      playerId: socket.id, playerName: current.name,
      streak: current.streak,
      room: getRoomSafe(room),
    });

    const active = getActivePlayers(room);
    if (active.length <= 1) return checkGameOver(io, room);
    scheduleNextTurn(io, room, 700);
  });

  // ─── MANUAL PAUSE (siapa saja bisa, saat game playing) ───
  socket.on('pause_game', () => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.status !== 'playing') return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p) return;
    pauseGame(io, room, socket.id, p.name, 'manual');
  });

  // ─── RESUME (siapa saja bisa, saat game paused) ───
  socket.on('resume_game', () => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.status !== 'paused') return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p) return;
    resumeGame(io, room, p.name);
  });

  socket.on(EVENTS.LEAVE_ROOM, () => {
    const code = playerRoom.get(socket.id);
    if (code) leaveRoom(socket, code);
    socket.emit('left_room');
  });

  socket.on('play_again', () => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit(EVENTS.ERROR, { message: 'Cuma host yang bisa reset!' });

    clearTurnTimer(room);
    room.status = 'waiting';
    room.usedWords = new Set();
    room.turnIndex = 0;
    room.currentPrefix = null;
    room.totalWords = 0;
    room.pausedBy = null;
    room.pauseReason = null;
    room.pausedPlayerName = null;
    room.players.forEach(p => {
      p.lives = GAME_CONFIG.STARTING_LIVES;
      p.wordsCount = 0;
      p.eliminated = false;
      p.streak = 0;
    });

    io.to(code).emit('room_reset', {
      room: getRoomSafe(room),
      message: 'Reset! Semua kata bisa dipakai lagi. Balik ke lobby 🎮',
    });
  });

  socket.on('player_typing', ({ text }) => {
    const code = playerRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.status !== 'playing') return;
    const current = getCurrentPlayer(room);
    if (!current || current.id !== socket.id) return;
    socket.to(code).emit('player_typing', {
      playerId: socket.id,
      playerName: current.name,
      text: (text || '').toLowerCase().slice(0, 30),
    });
  });

  socket.on('disconnect', () => {
    const code = playerRoom.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room) {
        // Selalu leaveRoom — refresh = keluar permanen
        leaveRoom(socket, code);
      }
    }
    console.log('[-] Disconnected:', socket.id);
  });

  function leaveRoom(socket, code) {
    const room = rooms.get(code);
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;
    const player = room.players[idx];
    room.players.splice(idx, 1);
    playerRoom.delete(socket.id);
    socket.leave(code);

    if (room.players.length === 0) {
      clearTurnTimer(room);
      rooms.delete(code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      io.to(code).emit(EVENTS.HOST_CHANGED, {
        newHostId: room.hostId,
        newHostName: room.players[0].name,
      });
    }

    if (room.status === 'playing' || room.status === 'paused') {
      const activeBefore = getActivePlayers(room); // sudah exclude player yang baru di-splice
      // activeBefore = sisa player aktif setelah player ini pergi

      if (activeBefore.length <= 1) {
        // ── Tinggal 1 atau 0 → game over ──
        room.status = 'playing'; // biar checkGameOver jalan normal
        checkGameOver(io, room);
      } else {
        // ── Masih ≥2 player → cek apakah perlu pause atau langsung lanjut ──
        if (room.turnIndex >= activeBefore.length) {
          room.turnIndex = room.turnIndex % activeBefore.length;
        }

        // Beritahu semua bahwa player keluar
        io.to(code).emit(EVENTS.PLAYER_LEFT, {
          room: getRoomSafe(room),
          playerName: player?.name,
        });

        if (room.status === 'paused' && room.pausedBy === socket.id) {
          // Yang disconnect adalah penyebab pause → auto resume sekarang
          resumeGame(io, room, null);
        } else if (room.status === 'paused') {
          // Game sudah pause karena sebab lain → tetap pause
          io.to(code).emit('game_paused', {
            reason: room.pauseReason,
            playerName: room.pausedPlayerName,
            room: getRoomSafe(room),
          });
        } else {
          // Game sedang playing & ≥2 player aktif → pause sebentar, notif, lalu resume otomatis
          clearTurnTimer(room);
          room.status = 'paused';
          room.pausedBy = socket.id;
          room.pauseReason = 'disconnect';
          room.pausedPlayerName = player?.name;
          io.to(code).emit('game_paused', {
            reason: 'disconnect',
            playerName: player?.name,
            autoResume: true,   // ≥3 player: overlay sebentar lalu auto lanjut
            room: getRoomSafe(room),
          });
          // Resume otomatis setelah 2 detik
          setTimeout(() => {
            if (rooms.has(code) && room.status === 'paused' && room.pausedBy === socket.id) {
              resumeGame(io, room, null);
            }
          }, 2000);
        }
      }
    } else {
      io.to(code).emit(EVENTS.PLAYER_LEFT, { room: getRoomSafe(room), playerName: player?.name });
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 NextWord Server v4.0 — http://localhost:${PORT}`);
  console.log(`📚 Kamus: ${VALID_WORDS.size} kata`);
  console.log(`🔑 Prefix index: ${prefixIndex.size} entri\n`);
});
