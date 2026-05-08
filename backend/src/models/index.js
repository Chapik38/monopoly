const sequelize = require('../config/database');
const User = require('./User');
const Room = require('./Room');
const RoomPlayer = require('./RoomPlayer');
const GameSession = require('./GameSession');
const GamePlayer = require('./GamePlayer');
const BoardCell = require('./BoardCell');
const PropertyState = require('./PropertyState');
const EventCard = require('./EventCard');
const GameEvent = require('./GameEvent');

// Associations
Room.belongsTo(User, { as: 'host', foreignKey: 'host_id' });
Room.hasMany(RoomPlayer, { as: 'players', foreignKey: 'room_id' });
RoomPlayer.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
RoomPlayer.belongsTo(Room, { foreignKey: 'room_id' });

GameSession.belongsTo(Room, { foreignKey: 'room_id' });
GameSession.hasMany(GamePlayer, { as: 'players', foreignKey: 'session_id' });
GameSession.hasMany(PropertyState, { as: 'properties', foreignKey: 'session_id' });
GameSession.hasMany(GameEvent, { as: 'events', foreignKey: 'session_id' });

GamePlayer.belongsTo(GameSession, { foreignKey: 'session_id' });
GamePlayer.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
GamePlayer.hasMany(PropertyState, { as: 'owned_properties', foreignKey: 'owner_id' });

PropertyState.belongsTo(GameSession, { foreignKey: 'session_id' });
PropertyState.belongsTo(GamePlayer, { as: 'owner', foreignKey: 'owner_id' });
PropertyState.belongsTo(BoardCell, { as: 'cell', foreignKey: 'cell_position', targetKey: 'position' });

GameEvent.belongsTo(GameSession, { foreignKey: 'session_id' });
GameEvent.belongsTo(GamePlayer, { as: 'player', foreignKey: 'player_id' });

module.exports = {
  sequelize,
  User,
  Room,
  RoomPlayer,
  GameSession,
  GamePlayer,
  BoardCell,
  PropertyState,
  EventCard,
  GameEvent,
};
