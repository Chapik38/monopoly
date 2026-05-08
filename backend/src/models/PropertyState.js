const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PropertyState = sequelize.define('PropertyState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cell_position: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rent_level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'property_states',
  timestamps: false,
});

module.exports = PropertyState;
