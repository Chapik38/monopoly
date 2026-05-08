const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BoardCell = sequelize.define('BoardCell', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  cell_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  color_group: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  purchase_price: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rent_level_0: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_level_1: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_level_2: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_level_3: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_level_4: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_level_5: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'board_cells',
  timestamps: false,
});

module.exports = BoardCell;
