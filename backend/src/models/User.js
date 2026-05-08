const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  avatar: {
    type: DataTypes.STRING(255),
    defaultValue: '',
  },
  games_played: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  games_won: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
