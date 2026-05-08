const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameSession = sequelize.define('GameSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'finished'),
    defaultValue: 'active',
  },
  current_player_index: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  turn_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  winner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  starting_capital: {
    type: DataTypes.INTEGER,
    defaultValue: 1500,
  },
  include_property_value: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  finished_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'game_sessions',
  timestamps: true,
});

module.exports = GameSession;
