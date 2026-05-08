const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  max_players: {
    type: DataTypes.INTEGER,
    defaultValue: 6,
    validate: { min: 2, max: 6 },
  },
  status: {
    type: DataTypes.ENUM('waiting', 'playing', 'finished'),
    defaultValue: 'waiting',
  },
  host_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  starting_capital: {
    type: DataTypes.INTEGER,
    defaultValue: 1500,
  },
  game_session_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'rooms',
  timestamps: true,
});

module.exports = Room;
