const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoomPlayer = sequelize.define('RoomPlayer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_ready: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  chip_color: {
    type: DataTypes.STRING(30),
    defaultValue: 'red',
  },
}, {
  tableName: 'room_players',
  timestamps: true,
});

module.exports = RoomPlayer;
