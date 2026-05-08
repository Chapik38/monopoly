const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { GameSession, GamePlayer, PropertyState, BoardCell } = require('../models');
const gameEngine = require('../services/gameEngine');

const router = express.Router();

router.get('/:sessionId/state', authMiddleware, async (req, res) => {
  try {
    const state = await gameEngine.getGameState(parseInt(req.params.sessionId));
    if (!state) return res.status(404).json({ error: 'Сессия не найдена' });
    res.json(state);
  } catch (err) {
    console.error('Get state error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/roll', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const state = await gameEngine.getGameState(sessionId);
    if (!state || state.status !== 'active') {
      return res.status(400).json({ error: 'Игра не активна' });
    }

    const currentPlayer = gameEngine.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Сейчас не ваш ход' });
    }

    const player = await GamePlayer.findByPk(currentPlayer.id);

    if (player.in_jail) {
      return res.status(400).json({ error: 'Вы в тюрьме. Используйте действия тюрьмы.' });
    }

    const dice = gameEngine.rollDice();

    await gameEngine.logEvent(sessionId, player.id, 'dice_roll', {
      die1: dice.die1,
      die2: dice.die2,
      total: dice.total,
    });

    const moveResult = await gameEngine.movePlayer(sessionId, player.id, dice.total);
    const cellResult = await gameEngine.processCell(sessionId, player.id);

    const updatedState = await gameEngine.getGameState(sessionId);

    if (cellResult.action !== 'buy_or_auction' &&
        cellResult.action !== 'location' &&
        updatedState.status === 'active') {
      if (!dice.is_double) {
        await gameEngine.advanceTurn(sessionId);
      }
    }

    const finalState = await gameEngine.getGameState(sessionId);

    res.json({
      dice,
      passed_go: moveResult.passedGo,
      cell_result: cellResult,
      game_state: finalState,
    });
  } catch (err) {
    console.error('Roll error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/buy', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const state = await gameEngine.getGameState(sessionId);
    if (!state || state.status !== 'active') {
      return res.status(400).json({ error: 'Игра не активна' });
    }

    const currentPlayer = gameEngine.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Сейчас не ваш ход' });
    }

    const player = await GamePlayer.findByPk(currentPlayer.id);
    const result = await gameEngine.buyProperty(sessionId, player.id, player.position);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    await gameEngine.advanceTurn(sessionId);
    const finalState = await gameEngine.getGameState(sessionId);

    res.json({ result, game_state: finalState });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/auction/start', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const state = await gameEngine.getGameState(sessionId);
    if (!state || state.status !== 'active') {
      return res.status(400).json({ error: 'Игра не активна' });
    }

    const currentPlayer = gameEngine.getCurrentPlayer(state);
    if (!currentPlayer || currentPlayer.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Сейчас не ваш ход' });
    }

    const player = await GamePlayer.findByPk(currentPlayer.id);
    const cell = await BoardCell.findOne({ where: { position: player.position } });
    const propState = await PropertyState.findOne({
      where: { session_id: sessionId, cell_position: player.position },
    });

    if (!cell || !propState || propState.owner_id) {
      return res.status(400).json({ error: 'Эту собственность нельзя выставить на аукцион' });
    }

    const eligiblePlayers = state.players.filter(p => p.is_active && !p.is_bankrupt && !p.in_jail);

    res.json({
      auction: {
        cell_position: cell.position,
        name: cell.name,
        min_bid: 10,
        eligible_players: eligiblePlayers.map(p => ({ id: p.id, user_id: p.user_id, username: p.username })),
      },
    });
  } catch (err) {
    console.error('Auction start error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/auction/bid', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { cell_position, amount } = req.body;

    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });
    if (player.in_jail) return res.status(400).json({ error: 'Нельзя участвовать в аукционе из тюрьмы' });
    if (player.balance < amount) return res.status(400).json({ error: 'Недостаточно средств' });

    const result = await gameEngine.buyProperty(sessionId, player.id, cell_position);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const priceDiff = amount - (await BoardCell.findOne({ where: { position: cell_position } })).purchase_price;
    if (priceDiff > 0) {
      player.balance -= priceDiff;
      await player.save();
    }

    await gameEngine.advanceTurn(sessionId);
    const finalState = await gameEngine.getGameState(sessionId);

    res.json({ result, game_state: finalState });
  } catch (err) {
    console.error('Auction bid error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/auction/skip', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    await gameEngine.advanceTurn(sessionId);
    const finalState = await gameEngine.getGameState(sessionId);
    res.json({ message: 'Аукцион пропущен', game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/jail/pay', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    const result = await gameEngine.jailPayToExit(sessionId, player.id);
    if (!result.success) return res.status(400).json({ error: result.error });

    const finalState = await gameEngine.getGameState(sessionId);
    res.json({ result, game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/jail/roll', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    const result = await gameEngine.jailRollForDoubles(sessionId, player.id);
    if (!result.success) return res.status(400).json({ error: result.error });

    if (result.freed && !result.forced_pay) {
      const moveResult = await gameEngine.movePlayer(sessionId, player.id, result.dice.total);
      const cellResult = await gameEngine.processCell(sessionId, player.id);

      if (cellResult.action !== 'buy_or_auction' && cellResult.action !== 'location') {
        await gameEngine.advanceTurn(sessionId);
      }

      const finalState = await gameEngine.getGameState(sessionId);
      return res.json({ result, move_result: { passed_go: moveResult.passedGo }, cell_result: cellResult, game_state: finalState });
    }

    if (!result.freed) {
      await gameEngine.advanceTurn(sessionId);
    }

    const finalState = await gameEngine.getGameState(sessionId);
    res.json({ result, game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/location/move', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { target_position } = req.body;

    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    const result = await gameEngine.locationMove(sessionId, player.id, target_position);
    if (!result.success) return res.status(400).json({ error: result.error });

    const cellResult = await gameEngine.processCell(sessionId, player.id);

    if (cellResult.action !== 'buy_or_auction' && cellResult.action !== 'location') {
      await gameEngine.advanceTurn(sessionId);
    }

    const finalState = await gameEngine.getGameState(sessionId);
    res.json({ result, cell_result: cellResult, game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/location/skip', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    await gameEngine.advanceTurn(sessionId);
    const finalState = await gameEngine.getGameState(sessionId);
    res.json({ message: 'Перемещение пропущено', game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/exit/vote', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { agree_to_exit } = req.body;

    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    const result = await gameEngine.handleExitVote(sessionId, player.id, agree_to_exit);
    const finalState = await gameEngine.getGameState(sessionId);

    res.json({ result, game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:sessionId/exit/leave', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const player = await GamePlayer.findOne({
      where: { session_id: sessionId, user_id: req.user.id },
    });
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });

    const result = await gameEngine.playerLeaveGame(sessionId, player.id);
    const finalState = await gameEngine.getGameState(sessionId);

    res.json({ result, game_state: finalState });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:sessionId/events', authMiddleware, async (req, res) => {
  try {
    const { GameEvent } = require('../models');
    const events = await GameEvent.findAll({
      where: { session_id: parseInt(req.params.sessionId) },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
