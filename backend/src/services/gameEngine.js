const { GameSession, GamePlayer, PropertyState, BoardCell, EventCard, GameEvent, User } = require('../models');
const sequelize = require('../config/database');

const BOARD_SIZE = 40;
const JAIL_POSITION = 10;
const GO_POSITION = 0;
const GO_SALARY = 200;
const JAIL_FEE = 100;
const LOCATION_FEE = 100;
const MAX_JAIL_TURNS = 3;

const COLOR_GROUPS = {
  brown: [1, 3],
  light_blue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  dark_blue: [37, 39],
  railroad: [5, 15, 25, 35],
};

function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2, is_double: die1 === die2 };
}

async function getGameState(sessionId) {
  const session = await GameSession.findByPk(sessionId);
  if (!session) return null;

  const players = await GamePlayer.findAll({
    where: { session_id: sessionId },
    include: [{ model: User, as: 'user', attributes: ['username', 'avatar'] }],
    order: [['turn_order', 'ASC']],
  });

  const properties = await PropertyState.findAll({
    where: { session_id: sessionId },
    include: [{ model: BoardCell, as: 'cell' }],
  });

  const board = await BoardCell.findAll({ order: [['position', 'ASC']] });

  const playerStates = players.map(p => {
    const ownedProps = properties.filter(pr => pr.owner_id === p.id).map(pr => pr.cell_position);
    return {
      id: p.id,
      user_id: p.user_id,
      username: p.user ? p.user.username : 'Unknown',
      avatar: p.user ? p.user.avatar : '',
      position: p.position,
      balance: p.balance,
      is_bankrupt: p.is_bankrupt,
      in_jail: p.in_jail,
      jail_turns: p.jail_turns,
      turn_order: p.turn_order,
      chip_color: p.chip_color,
      is_active: p.is_active,
      wants_to_exit: p.wants_to_exit,
      properties: ownedProps,
    };
  });

  const propertyStates = properties.map(pr => ({
    cell_position: pr.cell_position,
    name: pr.cell ? pr.cell.name : '',
    color_group: pr.cell ? pr.cell.color_group : null,
    purchase_price: pr.cell ? pr.cell.purchase_price : null,
    rent_levels: pr.cell ? [pr.cell.rent_level_0, pr.cell.rent_level_1, pr.cell.rent_level_2, pr.cell.rent_level_3, pr.cell.rent_level_4, pr.cell.rent_level_5] : [],
    owner_id: pr.owner_id,
    rent_level: pr.rent_level,
  }));

  const boardState = board.map(c => ({
    position: c.position,
    cell_type: c.cell_type,
    name: c.name,
    color_group: c.color_group,
    purchase_price: c.purchase_price,
    rent_levels: [c.rent_level_0, c.rent_level_1, c.rent_level_2, c.rent_level_3, c.rent_level_4, c.rent_level_5],
  }));

  return {
    session_id: session.id,
    status: session.status,
    current_player_index: session.current_player_index,
    turn_number: session.turn_number,
    winner_id: session.winner_id,
    players: playerStates,
    properties: propertyStates,
    board: boardState,
  };
}

function getCurrentPlayer(gameState) {
  const activePlayers = gameState.players.filter(p => p.is_active && !p.is_bankrupt);
  if (activePlayers.length === 0) return null;
  const idx = gameState.current_player_index % activePlayers.length;
  return activePlayers[idx];
}

async function movePlayer(sessionId, playerId, steps) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player) return null;

  const oldPosition = player.position;
  const newPosition = (oldPosition + steps) % BOARD_SIZE;
  const passedGo = (oldPosition + steps) >= BOARD_SIZE && newPosition !== GO_POSITION;

  player.position = newPosition;
  if (passedGo || newPosition === GO_POSITION) {
    player.balance += GO_SALARY;
  }
  await player.save();

  await logEvent(sessionId, playerId, 'move', {
    from: oldPosition,
    to: newPosition,
    steps,
    passed_go: passedGo || newPosition === GO_POSITION,
  });

  return { player, passedGo: passedGo || newPosition === GO_POSITION };
}

async function processCell(sessionId, playerId) {
  const player = await GamePlayer.findByPk(playerId);
  const cell = await BoardCell.findOne({ where: { position: player.position } });
  if (!cell) return { action: 'none' };

  switch (cell.cell_type) {
    case 'property':
      return await processPropertyCell(sessionId, player, cell);
    case 'event':
      return await processEventCell(sessionId, player);
    case 'location':
      return { action: 'location', fee: LOCATION_FEE };
    case 'go_to_jail':
      return await processGoToJail(sessionId, player);
    case 'tax':
      return await processTax(sessionId, player, cell);
    case 'go':
    case 'jail':
    case 'parking':
      return { action: 'none' };
    default:
      return { action: 'none' };
  }
}

async function processPropertyCell(sessionId, player, cell) {
  const propState = await PropertyState.findOne({
    where: { session_id: sessionId, cell_position: cell.position },
  });

  if (!propState || !propState.owner_id) {
    return {
      action: 'buy_or_auction',
      property: {
        position: cell.position,
        name: cell.name,
        price: cell.purchase_price,
        color_group: cell.color_group,
      },
    };
  }

  if (propState.owner_id === player.id) {
    const newLevel = Math.min(propState.rent_level + 1, 5);
    propState.rent_level = newLevel;
    await propState.save();
    await logEvent(sessionId, player.id, 'rent_level_up_own', {
      cell: cell.position,
      new_level: newLevel,
    });
    return { action: 'own_property', rent_level: newLevel };
  }

  const owner = await GamePlayer.findByPk(propState.owner_id);
  if (!owner || owner.is_bankrupt || !owner.is_active) {
    return { action: 'none' };
  }

  const rentLevels = [cell.rent_level_0, cell.rent_level_1, cell.rent_level_2, cell.rent_level_3, cell.rent_level_4, cell.rent_level_5];
  const rentAmount = rentLevels[propState.rent_level] || 0;

  const rentResult = await payRent(sessionId, player, owner, rentAmount, propState, cell);
  return rentResult;
}

async function payRent(sessionId, payer, owner, amount, propState, cell) {
  const ownerInJail = owner.in_jail;

  if (payer.balance >= amount) {
    payer.balance -= amount;
    owner.balance += amount;
    await payer.save();
    await owner.save();

    if (!ownerInJail) {
      const newLevel = Math.min(propState.rent_level + 1, 5);
      propState.rent_level = newLevel;
      await propState.save();
    }

    await logEvent(sessionId, payer.id, 'pay_rent', {
      to: owner.id,
      amount,
      cell: cell.position,
      rent_level_increased: !ownerInJail,
    });

    return {
      action: 'paid_rent',
      amount,
      owner_id: owner.id,
      rent_level_increased: !ownerInJail,
    };
  }

  const debtResult = await handleDebt(sessionId, payer, owner, amount);
  return debtResult;
}

async function handleDebt(sessionId, debtor, creditor, totalDebt) {
  let remaining = totalDebt;
  const soldProperties = [];

  if (debtor.balance > 0) {
    const paid = Math.min(debtor.balance, remaining);
    debtor.balance -= paid;
    if (creditor) creditor.balance += paid;
    remaining -= paid;
  }

  if (remaining > 0) {
    const ownedProps = await PropertyState.findAll({
      where: { session_id: sessionId, owner_id: debtor.id },
      include: [{ model: BoardCell, as: 'cell' }],
    });

    for (const prop of ownedProps) {
      if (remaining <= 0) break;
      const sellPrice = prop.cell ? prop.cell.purchase_price : 0;
      remaining -= sellPrice;
      if (creditor) creditor.balance += sellPrice;
      prop.owner_id = null;
      prop.rent_level = 0;
      await prop.save();
      soldProperties.push(prop.cell_position);
    }
  }

  await debtor.save();
  if (creditor) await creditor.save();

  if (remaining > 0) {
    debtor.is_bankrupt = true;
    debtor.is_active = false;
    await debtor.save();

    await logEvent(sessionId, debtor.id, 'bankruptcy', { debt: totalDebt, sold: soldProperties });

    const gameOver = await checkGameEnd(sessionId);
    return {
      action: 'bankruptcy',
      player_id: debtor.id,
      sold_properties: soldProperties,
      game_over: gameOver,
    };
  }

  await logEvent(sessionId, debtor.id, 'debt_paid', {
    total: totalDebt,
    sold: soldProperties,
  });

  return {
    action: 'debt_paid',
    sold_properties: soldProperties,
  };
}

async function checkGameEnd(sessionId) {
  const session = await GameSession.findByPk(sessionId);
  const players = await GamePlayer.findAll({ where: { session_id: sessionId } });
  const hasBankrupt = players.some(p => p.is_bankrupt);

  if (hasBankrupt) {
    const activePlayers = players.filter(p => !p.is_bankrupt && p.is_active);
    let winnerId = null;
    let maxWealth = -1;

    for (const p of activePlayers) {
      let wealth = p.balance;
      if (session.include_property_value) {
        const props = await PropertyState.findAll({
          where: { session_id: sessionId, owner_id: p.id },
          include: [{ model: BoardCell, as: 'cell' }],
        });
        for (const pr of props) {
          wealth += pr.cell ? pr.cell.purchase_price : 0;
        }
      }
      if (wealth > maxWealth) {
        maxWealth = wealth;
        winnerId = p.id;
      }
    }

    session.status = 'finished';
    session.winner_id = winnerId;
    session.finished_at = new Date();
    await session.save();

    if (winnerId) {
      const winner = await GamePlayer.findByPk(winnerId);
      if (winner) {
        await User.increment('games_won', { where: { id: winner.user_id } });
      }
    }

    for (const p of players) {
      await User.increment('games_played', { where: { id: p.user_id } });
    }

    await logEvent(sessionId, winnerId || 0, 'game_over', { winner_id: winnerId });
    return true;
  }

  return false;
}

async function processEventCell(sessionId, player) {
  const cards = await EventCard.findAll({ where: { card_type: 'event' } });
  if (cards.length === 0) return { action: 'none' };

  const card = cards[Math.floor(Math.random() * cards.length)];
  let result = { action: 'event', card: { title: card.title, description: card.description, effect_type: card.effect_type } };

  switch (card.effect_type) {
    case 'money': {
      player.balance += card.effect_value;
      if (player.balance < 0) {
        const debtResult = await handleDebt(sessionId, player, null, Math.abs(player.balance));
        player.balance = 0;
        await player.save();
        result.debt_result = debtResult;
      } else {
        await player.save();
      }
      result.amount = card.effect_value;
      break;
    }
    case 'jail': {
      player.position = JAIL_POSITION;
      player.in_jail = true;
      player.jail_turns = 0;
      await player.save();
      result.action = 'event_jail';
      break;
    }
    case 'rent_up': {
      const ownedProps = await PropertyState.findAll({
        where: { session_id: sessionId, owner_id: player.id },
      });
      if (ownedProps.length > 0) {
        const randomProp = ownedProps[Math.floor(Math.random() * ownedProps.length)];
        randomProp.rent_level = Math.min(randomProp.rent_level + card.effect_value, 5);
        await randomProp.save();
        result.property_position = randomProp.cell_position;
        result.new_rent_level = randomProp.rent_level;
      }
      break;
    }
    case 'rent_down': {
      const ownedProps2 = await PropertyState.findAll({
        where: { session_id: sessionId, owner_id: player.id },
      });
      if (ownedProps2.length > 0) {
        const randomProp = ownedProps2[Math.floor(Math.random() * ownedProps2.length)];
        randomProp.rent_level = Math.max(randomProp.rent_level - card.effect_value, 0);
        await randomProp.save();
        result.property_position = randomProp.cell_position;
        result.new_rent_level = randomProp.rent_level;
      }
      break;
    }
    case 'move_to_go': {
      player.position = GO_POSITION;
      player.balance += GO_SALARY;
      await player.save();
      result.action = 'event_move_to_go';
      break;
    }
  }

  await logEvent(sessionId, player.id, 'event_card', {
    card_title: card.title,
    effect_type: card.effect_type,
    effect_value: card.effect_value,
  });

  return result;
}

async function processGoToJail(sessionId, player) {
  player.position = JAIL_POSITION;
  player.in_jail = true;
  player.jail_turns = 0;
  await player.save();

  await logEvent(sessionId, player.id, 'go_to_jail', {});
  return { action: 'go_to_jail' };
}

async function processTax(sessionId, player, cell) {
  const taxAmount = cell.rent_level_0;
  if (player.balance >= taxAmount) {
    player.balance -= taxAmount;
    await player.save();
    await logEvent(sessionId, player.id, 'tax', { amount: taxAmount });
    return { action: 'tax', amount: taxAmount };
  }

  const debtResult = await handleDebt(sessionId, player, null, taxAmount);
  return { action: 'tax', amount: taxAmount, debt_result: debtResult };
}

async function buyProperty(sessionId, playerId, cellPosition) {
  const player = await GamePlayer.findByPk(playerId);
  const cell = await BoardCell.findOne({ where: { position: cellPosition } });
  const propState = await PropertyState.findOne({
    where: { session_id: sessionId, cell_position: cellPosition },
  });

  if (!player || !cell || !propState) return { success: false, error: 'Данные не найдены' };
  if (propState.owner_id) return { success: false, error: 'Собственность уже принадлежит другому игроку' };
  if (player.balance < cell.purchase_price) return { success: false, error: 'Недостаточно средств' };

  player.balance -= cell.purchase_price;
  propState.owner_id = player.id;
  propState.rent_level = 1;

  await player.save();
  await propState.save();

  await recalculateColorGroupBonuses(sessionId, cell.color_group);

  await logEvent(sessionId, playerId, 'buy_property', {
    cell: cellPosition,
    price: cell.purchase_price,
  });

  return { success: true, balance: player.balance };
}

async function recalculateColorGroupBonuses(sessionId, colorGroup) {
  if (!colorGroup || !COLOR_GROUPS[colorGroup]) return;

  const positions = COLOR_GROUPS[colorGroup];
  const props = await PropertyState.findAll({
    where: { session_id: sessionId, cell_position: positions },
  });

  const ownedProps = props.filter(p => p.owner_id !== null);
  if (ownedProps.length === 0) return;

  const ownerIds = [...new Set(ownedProps.map(p => p.owner_id))];
  const allOwned = ownedProps.length === positions.length;

  if (allOwned && ownerIds.length === 1) {
    for (const prop of ownedProps) {
      prop.rent_level = Math.min(prop.rent_level + 2, 5);
      await prop.save();
    }
  } else if (ownerIds.length >= 2) {
    for (const prop of ownedProps) {
      prop.rent_level = Math.min(prop.rent_level + 1, 5);
      await prop.save();
    }
  }
}

async function jailPayToExit(sessionId, playerId) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player || !player.in_jail) return { success: false, error: 'Игрок не в тюрьме' };

  if (player.balance >= JAIL_FEE) {
    player.balance -= JAIL_FEE;
    player.in_jail = false;
    player.jail_turns = 0;
    await player.save();
    await logEvent(sessionId, playerId, 'jail_pay_exit', { fee: JAIL_FEE });
    return { success: true, balance: player.balance };
  }

  const debtResult = await handleDebt(sessionId, player, null, JAIL_FEE);
  if (!player.is_bankrupt) {
    player.in_jail = false;
    player.jail_turns = 0;
    await player.save();
  }
  return { success: true, balance: player.balance, debt_result: debtResult };
}

async function jailRollForDoubles(sessionId, playerId) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player || !player.in_jail) return { success: false, error: 'Игрок не в тюрьме' };

  const dice = rollDice();
  player.jail_turns += 1;

  await logEvent(sessionId, playerId, 'jail_roll', {
    die1: dice.die1,
    die2: dice.die2,
    is_double: dice.is_double,
    attempt: player.jail_turns,
  });

  if (dice.is_double) {
    player.in_jail = false;
    player.jail_turns = 0;
    await player.save();
    return { success: true, freed: true, dice, balance: player.balance };
  }

  if (player.jail_turns >= MAX_JAIL_TURNS) {
    const payResult = await jailPayToExit(sessionId, playerId);
    return { success: true, freed: !player.in_jail, dice, forced_pay: true, pay_result: payResult };
  }

  await player.save();
  return { success: true, freed: false, dice, attempts_left: MAX_JAIL_TURNS - player.jail_turns };
}

async function advanceTurn(sessionId) {
  const session = await GameSession.findByPk(sessionId);
  const players = await GamePlayer.findAll({
    where: { session_id: sessionId, is_active: true, is_bankrupt: false },
    order: [['turn_order', 'ASC']],
  });

  if (players.length <= 1) return;

  session.current_player_index = (session.current_player_index + 1) % players.length;
  session.turn_number += 1;
  await session.save();
}

async function locationMove(sessionId, playerId, targetPosition) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player) return { success: false, error: 'Игрок не найден' };

  const targetCell = await BoardCell.findOne({ where: { position: targetPosition } });
  if (!targetCell || targetCell.cell_type !== 'property') {
    return { success: false, error: 'Можно перемещаться только на поле собственности' };
  }

  if (player.balance < LOCATION_FEE) {
    return { success: false, error: 'Недостаточно средств для перемещения' };
  }

  player.balance -= LOCATION_FEE;
  player.position = targetPosition;
  await player.save();

  await logEvent(sessionId, playerId, 'location_move', {
    to: targetPosition,
    fee: LOCATION_FEE,
  });

  return { success: true, position: targetPosition, balance: player.balance };
}

async function logEvent(sessionId, playerId, eventType, details) {
  await GameEvent.create({
    session_id: sessionId,
    player_id: playerId,
    event_type: eventType,
    details,
  });
}

async function handleExitVote(sessionId, playerId, agreesToExit) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player) return { success: false, error: 'Игрок не найден' };

  player.wants_to_exit = agreesToExit;
  await player.save();

  const allPlayers = await GamePlayer.findAll({
    where: { session_id: sessionId, is_active: true, is_bankrupt: false },
  });

  const totalActive = allPlayers.length;
  const wantExit = allPlayers.filter(p => p.wants_to_exit).length;

  if (wantExit > totalActive / 2) {
    const session = await GameSession.findByPk(sessionId);
    session.status = 'finished';
    session.finished_at = new Date();

    let winnerId = null;
    let maxBalance = -1;
    for (const p of allPlayers) {
      if (p.balance > maxBalance) {
        maxBalance = p.balance;
        winnerId = p.id;
      }
    }
    session.winner_id = winnerId;
    await session.save();

    for (const p of allPlayers) {
      await User.increment('games_played', { where: { id: p.user_id } });
    }
    if (winnerId) {
      const winner = await GamePlayer.findByPk(winnerId);
      if (winner) await User.increment('games_won', { where: { id: winner.user_id } });
    }

    return { success: true, game_ended: true, winner_id: winnerId };
  }

  const dontWantExit = totalActive - wantExit;
  if (dontWantExit > totalActive / 2) {
    for (const p of allPlayers) {
      p.wants_to_exit = false;
      await p.save();
    }
    return {
      success: true,
      game_ended: false,
      vote_rejected: true,
      players_who_wanted_exit: allPlayers.filter(p => p.wants_to_exit).map(p => p.id),
    };
  }

  return { success: true, game_ended: false, votes_so_far: wantExit, total: totalActive };
}

async function playerLeaveGame(sessionId, playerId) {
  const player = await GamePlayer.findByPk(playerId);
  if (!player) return { success: false };

  player.is_active = false;
  player.is_bankrupt = true;
  await player.save();

  const props = await PropertyState.findAll({
    where: { session_id: sessionId, owner_id: player.id },
  });
  for (const p of props) {
    p.owner_id = null;
    p.rent_level = 0;
    await p.save();
  }

  const gameOver = await checkGameEnd(sessionId);
  return { success: true, game_over: gameOver };
}

module.exports = {
  rollDice,
  getGameState,
  getCurrentPlayer,
  movePlayer,
  processCell,
  buyProperty,
  advanceTurn,
  jailPayToExit,
  jailRollForDoubles,
  locationMove,
  handleExitVote,
  playerLeaveGame,
  recalculateColorGroupBonuses,
  handleDebt,
  logEvent,
  BOARD_SIZE,
  JAIL_POSITION,
  GO_SALARY,
  LOCATION_FEE,
};
