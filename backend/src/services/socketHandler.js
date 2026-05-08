const { extractUserFromToken } = require('../middleware/auth');
const { GamePlayer, GameSession, Room, RoomPlayer, User } = require('../models');
const gameEngine = require('./gameEngine');

const roomSockets = {};
const gameSockets = {};

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Токен не предоставлен'));

    const user = extractUserFromToken(token);
    if (!user) return next(new Error('Недействительный токен'));

    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.user.id})`);

    socket.on('join_room', async (roomId) => {
      const roomKey = `room_${roomId}`;
      socket.join(roomKey);
      if (!roomSockets[roomKey]) roomSockets[roomKey] = new Set();
      roomSockets[roomKey].add(socket.id);

      const room = await Room.findByPk(roomId, {
        include: [{
          model: RoomPlayer,
          as: 'players',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
        }],
      });

      if (room) {
        io.to(roomKey).emit('room_update', {
          id: room.id,
          name: room.name,
          max_players: room.max_players,
          status: room.status,
          host_id: room.host_id,
          starting_capital: room.starting_capital,
          game_session_id: room.game_session_id,
          players: room.players.map(p => ({
            user_id: p.user_id,
            username: p.user ? p.user.username : '',
            avatar: p.user ? p.user.avatar : '',
            is_ready: p.is_ready,
            chip_color: p.chip_color,
          })),
        });
      }
    });

    socket.on('leave_room', (roomId) => {
      const roomKey = `room_${roomId}`;
      socket.leave(roomKey);
      if (roomSockets[roomKey]) roomSockets[roomKey].delete(socket.id);
    });

    socket.on('join_game', async (sessionId) => {
      const gameKey = `game_${sessionId}`;
      socket.join(gameKey);
      if (!gameSockets[gameKey]) gameSockets[gameKey] = new Set();
      gameSockets[gameKey].add(socket.id);

      const state = await gameEngine.getGameState(sessionId);
      if (state) {
        socket.emit('game_state', state);
      }
    });

    socket.on('leave_game', (sessionId) => {
      const gameKey = `game_${sessionId}`;
      socket.leave(gameKey);
      if (gameSockets[gameKey]) gameSockets[gameKey].delete(socket.id);
    });

    socket.on('game_action', async (data) => {
      const { sessionId } = data;
      const gameKey = `game_${sessionId}`;
      const state = await gameEngine.getGameState(sessionId);
      if (state) {
        io.to(gameKey).emit('game_state', state);
      }
    });

    socket.on('chat_message', (data) => {
      const { roomId, sessionId, message } = data;
      const target = sessionId ? `game_${sessionId}` : `room_${roomId}`;
      io.to(target).emit('chat_message', {
        user_id: socket.user.id,
        username: socket.user.username,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('exit_vote_initiated', (data) => {
      const { sessionId } = data;
      const gameKey = `game_${sessionId}`;
      io.to(gameKey).emit('exit_vote_request', {
        initiated_by: socket.user.id,
        username: socket.user.username,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username}`);
      for (const key in roomSockets) {
        roomSockets[key].delete(socket.id);
      }
      for (const key in gameSockets) {
        gameSockets[key].delete(socket.id);
      }
    });
  });

  return io;
}

function broadcastGameState(io, sessionId, state) {
  const gameKey = `game_${sessionId}`;
  io.to(gameKey).emit('game_state', state);
}

function broadcastRoomUpdate(io, roomId, roomData) {
  const roomKey = `room_${roomId}`;
  io.to(roomKey).emit('room_update', roomData);
}

module.exports = { setupSocket, broadcastGameState, broadcastRoomUpdate };
