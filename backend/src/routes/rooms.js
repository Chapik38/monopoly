const express = require('express');
const { Room, RoomPlayer, User, GameSession, GamePlayer, PropertyState, BoardCell, EventCard } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { boardCells, eventCards } = require('../data/board');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.findAll({
      where: { status: 'waiting' },
      include: [{
        model: RoomPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
      }],
      order: [['createdAt', 'DESC']],
    });

    const result = rooms.map(r => ({
      id: r.id,
      name: r.name,
      max_players: r.max_players,
      status: r.status,
      host_id: r.host_id,
      starting_capital: r.starting_capital,
      players: r.players.map(p => ({
        user_id: p.user_id,
        username: p.user ? p.user.username : '',
        avatar: p.user ? p.user.avatar : '',
        is_ready: p.is_ready,
        chip_color: p.chip_color,
      })),
    }));

    res.json({ rooms: result });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, max_players, starting_capital } = req.body;
    if (!name) return res.status(400).json({ error: 'Название комнаты обязательно' });

    const maxP = Math.min(Math.max(max_players || 6, 2), 6);

    const existingPlayer = await RoomPlayer.findOne({
      include: [{
        model: Room,
        where: { status: ['waiting', 'playing'] },
      }],
      where: { user_id: req.user.id },
    });
    if (existingPlayer) {
      return res.status(400).json({ error: 'Вы уже находитесь в другой комнате или игре' });
    }

    const room = await Room.create({
      name,
      max_players: maxP,
      host_id: req.user.id,
      starting_capital: starting_capital || 1500,
    });

    await RoomPlayer.create({
      room_id: room.id,
      user_id: req.user.id,
      chip_color: 'red',
    });

    res.status(201).json({ room: { id: room.id, name: room.name, status: room.status } });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{ model: RoomPlayer, as: 'players' }],
    });
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    if (room.status !== 'waiting') return res.status(400).json({ error: 'Игра уже начата' });
    if (room.players.length >= room.max_players) return res.status(400).json({ error: 'Комната заполнена' });

    const alreadyIn = room.players.find(p => p.user_id === req.user.id);
    if (alreadyIn) return res.status(400).json({ error: 'Вы уже в этой комнате' });

    const existingPlayer = await RoomPlayer.findOne({
      include: [{
        model: Room,
        where: { status: ['waiting', 'playing'] },
      }],
      where: { user_id: req.user.id },
    });
    if (existingPlayer) {
      return res.status(400).json({ error: 'Вы уже находитесь в другой комнате или игре' });
    }

    const { chip_color } = req.body || {};
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const usedColors = room.players.map(p => p.chip_color);
    const color = chip_color && !usedColors.includes(chip_color) ? chip_color : colors.find(c => !usedColors.includes(c)) || 'red';

    await RoomPlayer.create({
      room_id: room.id,
      user_id: req.user.id,
      chip_color: color,
    });

    res.json({ message: 'Вы вошли в комнату' });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const rp = await RoomPlayer.findOne({
      where: { room_id: req.params.id, user_id: req.user.id },
    });
    if (!rp) return res.status(404).json({ error: 'Вы не в этой комнате' });

    await rp.destroy();

    const room = await Room.findByPk(req.params.id, {
      include: [{ model: RoomPlayer, as: 'players' }],
    });

    if (room && room.players.length === 0) {
      await room.destroy();
    } else if (room && room.host_id === req.user.id && room.players.length > 0) {
      room.host_id = room.players[0].user_id;
      await room.save();
    }

    res.json({ message: 'Вы вышли из комнаты' });
  } catch (err) {
    console.error('Leave room error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/ready', authMiddleware, async (req, res) => {
  try {
    const rp = await RoomPlayer.findOne({
      where: { room_id: req.params.id, user_id: req.user.id },
    });
    if (!rp) return res.status(404).json({ error: 'Вы не в этой комнате' });

    const body = req.body || {};
    rp.is_ready = body.is_ready !== undefined ? body.is_ready : !rp.is_ready;
    await rp.save();

    res.json({ is_ready: rp.is_ready });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{ model: RoomPlayer, as: 'players' }],
    });
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    if (room.host_id !== req.user.id) return res.status(403).json({ error: 'Только хост может начать игру' });
    if (room.status !== 'waiting') return res.status(400).json({ error: 'Игра уже начата' });
    if (room.players.length < 2) return res.status(400).json({ error: 'Нужно минимум 2 игрока' });

    const allReady = room.players.every(p => p.is_ready || p.user_id === room.host_id);
    if (!allReady) return res.status(400).json({ error: 'Не все игроки готовы' });

    const cellCount = await BoardCell.count();
    if (cellCount === 0) {
      await BoardCell.bulkCreate(boardCells);
    }
    const cardCount = await EventCard.count();
    if (cardCount === 0) {
      await EventCard.bulkCreate(eventCards);
    }

    const session = await GameSession.create({
      room_id: room.id,
      starting_capital: room.starting_capital,
    });

    const shuffledPlayers = room.players.sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledPlayers.length; i++) {
      await GamePlayer.create({
        session_id: session.id,
        user_id: shuffledPlayers[i].user_id,
        balance: room.starting_capital,
        turn_order: i,
        chip_color: shuffledPlayers[i].chip_color,
      });
    }

    const allCells = await BoardCell.findAll({ where: { cell_type: 'property' } });
    for (const cell of allCells) {
      await PropertyState.create({
        session_id: session.id,
        cell_position: cell.position,
        owner_id: null,
        rent_level: 0,
      });
    }

    room.status = 'playing';
    room.game_session_id = session.id;
    await room.save();

    res.json({ session_id: session.id, game_session_id: session.id, message: 'Игра начата!' });
  } catch (err) {
    console.error('Start game error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{
        model: RoomPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
      }],
    });
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });

    res.json({
      id: room.id,
      name: room.name,
      max_players: room.max_players,
      status: room.status,
      host_id: room.host_id,
      starting_capital: room.starting_capital,
      game_session_id: room.game_session_id,
      players: room.players.map(p => ({
        user_id: p.user_id,
        username: p.user ? p.user.username : '',
        avatar: p.user ? p.user.avatar : '',
        is_ready: p.is_ready,
        chip_color: p.chip_color,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
