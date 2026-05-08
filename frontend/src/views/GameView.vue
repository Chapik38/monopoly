<template>
  <div class="game-page" v-if="gameStore.gameState">
    <header class="game-header">
      <span class="turn-info">Ход #{{ gameStore.gameState.turn_number }}</span>
      <span class="current-turn" v-if="currentPlayerName">
        Ходит: <strong>{{ currentPlayerName }}</strong>
        <span v-if="gameStore.isMyTurn" class="your-turn">(Ваш ход!)</span>
      </span>
      <button class="btn-sm" @click="showExitVote = true">Выход из игры</button>
    </header>

    <div class="game-layout">
      <div class="board-container">
        <GameBoard
          :cells="boardCells"
          :players="gameStore.gameState.players"
          :properties="gameStore.gameState.properties"
        />
      </div>

      <div class="side-panel">
        <PlayersPanel :players="gameStore.gameState.players" :currentIndex="gameStore.gameState.current_player_index" />

        <div class="my-status" v-if="gameStore.myPlayer">
          <h3>Мой баланс: {{ gameStore.myPlayer.balance }}$</h3>
          <p v-if="gameStore.myPlayer.in_jail">В тюрьме (попыток: {{ gameStore.myPlayer.jail_turns }}/3)</p>
        </div>

        <div class="actions-panel" v-if="gameStore.isMyTurn && gameStore.gameState.status === 'active'">
          <template v-if="gameStore.myPlayer?.in_jail">
            <h3>Вы в тюрьме</h3>
            <button @click="jailPay" :disabled="gameStore.loading">Заплатить 100$</button>
            <button @click="jailRoll" :disabled="gameStore.loading">Бросить кубики (дубль)</button>
          </template>
          <template v-else-if="!hasRolled">
            <button class="btn-roll" @click="rollDice" :disabled="gameStore.loading">
              🎲 Бросить кубики
            </button>
          </template>
        </div>

        <DiceDisplay v-if="gameStore.lastDice" :dice="gameStore.lastDice" />

        <div class="cell-result" v-if="gameStore.lastCellResult">
          <CellResultPanel
            :result="gameStore.lastCellResult"
            :sessionId="sessionId"
            @action-done="onActionDone"
          />
        </div>

        <div class="event-log">
          <h3>Журнал событий</h3>
          <div class="log-entries">
            <div v-for="msg in gameStore.chatMessages.slice(-10)" :key="msg.timestamp" class="log-entry">
              <strong>{{ msg.username }}:</strong> {{ msg.message }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showExitVote" class="modal-overlay" @click.self="showExitVote = false">
      <div class="modal">
        <h2>Голосование за выход</h2>
        <p>Хотите предложить завершить игру?</p>
        <div class="modal-actions">
          <button @click="voteExit(true)">Да, завершить</button>
          <button @click="voteExit(false)">Нет, продолжить</button>
          <button class="btn-danger" @click="leaveGame">Покинуть игру (проигрыш)</button>
        </div>
        <button class="btn-close" @click="showExitVote = false">Закрыть</button>
      </div>
    </div>

    <div v-if="gameStore.gameState.status === 'finished'" class="modal-overlay">
      <div class="modal winner-modal">
        <h2>Игра окончена!</h2>
        <p v-if="gameStore.gameState.winner_id">
          Победитель: <strong>{{ winnerName }}</strong>
        </p>
        <button @click="$router.push('/rooms')">Вернуться в лобби</button>
      </div>
    </div>
  </div>
  <div v-else class="loading">Загрузка игры...</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { connectSocket } from '../services/socket';
import GameBoard from '../components/GameBoard.vue';
import PlayersPanel from '../components/PlayersPanel.vue';
import DiceDisplay from '../components/DiceDisplay.vue';
import CellResultPanel from '../components/CellResultPanel.vue';
import api from '../services/api';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const sessionId = computed(() => route.params.sessionId);

const hasRolled = ref(false);
const showExitVote = ref(false);
const boardCells = ref([]);
let socket = null;

const currentPlayerName = computed(() => {
  if (!gameStore.gameState) return '';
  const active = gameStore.gameState.players.filter(p => p.is_active && !p.is_bankrupt);
  const idx = gameStore.gameState.current_player_index % active.length;
  return active[idx]?.username || '';
});

const winnerName = computed(() => {
  if (!gameStore.gameState) return '';
  const w = gameStore.gameState.players.find(p => p.user_id === gameStore.gameState.winner_id);
  return w?.username || '';
});

async function rollDice() {
  try {
    await gameStore.rollDice(sessionId.value);
    hasRolled.value = true;
    socket?.emit('game_action', { sessionId: sessionId.value });
  } catch (e) { /* error set in store */ }
}

async function jailPay() {
  try {
    await gameStore.jailPay(sessionId.value);
    socket?.emit('game_action', { sessionId: sessionId.value });
  } catch (e) { /* error set in store */ }
}

async function jailRoll() {
  try {
    const res = await gameStore.jailRoll(sessionId.value);
    if (res.result?.freed) {
      hasRolled.value = true;
    }
    socket?.emit('game_action', { sessionId: sessionId.value });
  } catch (e) { /* error set in store */ }
}

async function voteExit(agree) {
  await gameStore.voteExit(sessionId.value, agree);
  showExitVote.value = false;
  socket?.emit('game_action', { sessionId: sessionId.value });
}

async function leaveGame() {
  await gameStore.leaveGame(sessionId.value);
  showExitVote.value = false;
  router.push('/rooms');
}

function onActionDone() {
  hasRolled.value = false;
  gameStore.lastCellResult = null;
  gameStore.lastDice = null;
  socket?.emit('game_action', { sessionId: sessionId.value });
}

onMounted(async () => {
  await gameStore.fetchGameState(sessionId.value);
  hasRolled.value = false;

  try {
    const res = await api.get(`/api/game/${sessionId.value}/state`);
    boardCells.value = res.data.board || [];
  } catch (e) { /* */ }

  socket = connectSocket();
  socket.emit('join_game', sessionId.value);

  socket.on('game_state', (gs) => {
    gameStore.setGameState(gs);
    if (gs.current_player_index !== gameStore.gameState?.current_player_index) {
      hasRolled.value = false;
    }
  });

  socket.on('chat_message', (msg) => {
    gameStore.addChatMessage(msg);
  });

  socket.on('exit_vote_request', (data) => {
    showExitVote.value = true;
  });
});

onUnmounted(() => {
  socket?.emit('leave_game', sessionId.value);
});
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}
.game-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}
.turn-info { color: #94a3b8; }
.current-turn { flex: 1; }
.your-turn { color: #22c55e; font-weight: 700; }
.btn-sm {
  padding: 0.4rem 1rem;
  background: #334155;
  color: #e2e8f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.game-layout {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  height: calc(100vh - 60px);
}
.board-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
}
.side-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
}
.my-status {
  background: #1e293b;
  padding: 0.75rem 1rem;
  border-radius: 10px;
}
.my-status h3 { margin: 0; color: #22c55e; }
.my-status p { margin: 0.25rem 0 0; color: #f59e0b; }
.actions-panel {
  background: #1e293b;
  padding: 1rem;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.actions-panel h3 { margin: 0 0 0.5rem; }
.actions-panel button, .btn-roll {
  padding: 0.7rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  background: #22c55e;
  color: #fff;
}
.btn-roll { font-size: 1.1rem; }
.actions-panel button:hover, .btn-roll:hover { opacity: 0.9; }
.actions-panel button:disabled, .btn-roll:disabled { opacity: 0.5; cursor: not-allowed; }
.cell-result {
  background: #1e293b;
  padding: 1rem;
  border-radius: 10px;
}
.event-log {
  background: #1e293b;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  flex: 1;
  overflow-y: auto;
}
.event-log h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
.log-entries { font-size: 0.85rem; color: #94a3b8; }
.log-entry { margin-bottom: 0.25rem; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}
.modal {
  background: #1e293b;
  padding: 2rem;
  border-radius: 16px;
  min-width: 360px;
  text-align: center;
}
.modal h2 { color: #22c55e; }
.modal-actions { display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0; }
.modal-actions button {
  padding: 0.7rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  background: #22c55e;
  color: #fff;
  font-weight: 600;
}
.modal-actions .btn-danger { background: #ef4444; }
.btn-close {
  margin-top: 0.5rem;
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}
.winner-modal h2 { color: #f59e0b; }
.winner-modal button {
  margin-top: 1rem;
  padding: 0.7rem 2rem;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #0f172a;
  color: #94a3b8;
  font-size: 1.2rem;
}
</style>
