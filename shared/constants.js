// shared/constants.js
const GAME_CONFIG = {
  MAX_PLAYERS: 5,
  MIN_PLAYERS: 2,
  TURN_TIME: 10,        // harus sama dengan server.js GAME_CONFIG.TURN_TIME
  STARTING_LIVES: 3,
  MIN_WORD_LENGTH: 3,
  EVENTS: {
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
    PLAYER_ELIMINATED: 'player_eliminated',
    GAME_OVER: 'game_over',
    LEAVE_ROOM: 'leave_room',
    ERROR: 'error',
  },
};
