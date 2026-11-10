// client/js/state.js
const State = {
  myId: null,
  myName: null,
  room: null,
  isMyTurn: false,
  currentPrefix: null,
  timeLeft: 10,
  totalWordsInGame: 0,

  reset() {
    this.room = null;
    this.isMyTurn = false;
    this.currentPrefix = null;
    this.timeLeft = 10;
    this.totalWordsInGame = 0;
  },

  setRoom(room) { this.room = room; },

  getMe() {
    if (!this.room || !this.myId) return null;
    return this.room.players.find(p => p.id === this.myId);
  },

  isHost() {
    return this.room && this.room.hostId === this.myId;
  },
};
