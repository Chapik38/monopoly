const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EventCard = sequelize.define('EventCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  card_type: {
    type: DataTypes.ENUM('event', 'location'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  effect_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  effect_value: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'event_cards',
  timestamps: false,
});

module.exports = EventCard;
