const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GamePlayer = sequelize.define('GamePlayer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 1500,
  },
  is_bankrupt: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  in_jail: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  jail_turns: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  turn_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  chip_color: {
    type: DataTypes.STRING(30),
    defaultValue: 'red',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  wants_to_exit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'game_players',
  timestamps: true,
});

module.exports = GamePlayer;
