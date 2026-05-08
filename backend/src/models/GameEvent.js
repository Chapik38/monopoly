const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameEvent = sequelize.define('GameEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  player_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'game_events',
  timestamps: true,
});

module.exports = GameEvent;
