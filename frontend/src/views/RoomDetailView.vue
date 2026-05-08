<template>
  <div class="room-detail-page">
    <header class="top-bar">
      <button class="btn-back" @click="$router.push('/rooms')">← Назад</button>
      <h1>{{ room?.name || 'Комната' }}</h1>
      <span class="room-id">ID: {{ room?.id }}</span>
    </header>

    <div class="room-body" v-if="room">
      <div class="players-section">
        <h2>Игроки ({{ players.length }} / {{ room.max_players }})</h2>
        <div class="players-grid">
          <div v-for="p in players" :key="p.user_id" class="player-card" :class="{ ready: p.is_ready }">
            <div class="chip" :style="{ background: p.chip_color || '#666' }"></div>
            <span class="player-name">{{ p.username || p.user_id }}</span>
            <span class="ready-status">{{ p.is_ready ? 'Готов' : 'Не готов' }}</span>
            <span v-if="room.host_id === p.user_id" class="host-badge">Хост</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <p><strong>Стартовый капитал:</strong> {{ room.starting_capital }}$</p>
        <p><strong>Макс. игроков:</strong> {{ room.max_players }}</p>
        <p><strong>Статус:</strong> {{ statusLabel }}</p>
      </div>

      <div class="actions">
        <template v-if="!isInRoom">
          <button class="btn-action" @click="joinRoom">Присоединиться</button>
        </template>
        <template v-else>
          <button class="btn-action" @click="toggleReady">
            {{ myPlayer?.is_ready ? 'Отменить готовность' : 'Готов' }}
          </button>
          <button class="btn-action btn-danger" @click="leaveRoom">Покинуть</button>
          <button v-if="isHost && allReady && players.length >= 2" class="btn-action btn-start" @click="startGame">
            Начать игру
          </button>
        </template>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const room = ref(null);
const players = ref([]);
const error = ref('');
let socket = null;

const isHost = computed(() => room.value?.host_id === authStore.user?.id);
const isInRoom = computed(() => players.value.some(p => p.user_id === authStore.user?.id));
const myPlayer = computed(() => players.value.find(p => p.user_id === authStore.user?.id));
const allReady = computed(() => players.value.length > 0 && players.value.every(p => p.is_ready));
const statusLabel = computed(() => {
  const s = room.value?.status;
  return s === 'waiting' ? 'Ожидание' : s === 'playing' ? 'В игре' : 'Завершена';
});

async function loadRoom() {
  try {
    const res = await api.get(`/api/rooms/${route.params.id}`);
    room.value = res.data.room || res.data;
    players.value = res.data.players || res.data.room?.players || [];
  } catch (err) {
    error.value = 'Не удалось загрузить комнату';
  }
}

async function joinRoom() {
  try {
    await api.post(`/api/rooms/${route.params.id}/join`);
    await loadRoom();
    socket?.emit('join_room', route.params.id);
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка';
  }
}

async function leaveRoom() {
  try {
    await api.post(`/api/rooms/${route.params.id}/leave`);
    socket?.emit('leave_room', route.params.id);
    router.push('/rooms');
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка';
  }
}

async function toggleReady() {
  try {
    await api.post(`/api/rooms/${route.params.id}/ready`);
    await loadRoom();
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка';
  }
}

async function startGame() {
  try {
    const res = await api.post(`/api/rooms/${route.params.id}/start`);
    const sessionId = res.data.game_session_id;
    router.push(`/game/${sessionId}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка старта';
  }
}

onMounted(async () => {
  await loadRoom();
  socket = connectSocket();
  socket.emit('join_room', route.params.id);

  socket.on('room_update', (data) => {
    room.value = data;
    players.value = data.players || [];
    if (data.game_session_id && data.status === 'playing') {
      router.push(`/game/${data.game_session_id}`);
    }
  });
});

onUnmounted(() => {
  socket?.emit('leave_room', route.params.id);
});
</script>

<style scoped>
.room-detail-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}
.top-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}
.top-bar h1 { flex: 1; font-size: 1.2rem; margin: 0; }
.btn-back {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
}
.room-id { color: #64748b; font-size: 0.85rem; }
.room-body { max-width: 700px; margin: 2rem auto; padding: 0 1rem; }
.players-section { margin-bottom: 1.5rem; }
.players-section h2 { color: #22c55e; }
.players-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.player-card {
  background: #1e293b;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 180px;
  border: 2px solid #334155;
}
.player-card.ready { border-color: #22c55e; }
.chip { width: 16px; height: 16px; border-radius: 50%; }
.player-name { font-weight: 600; flex: 1; }
.ready-status { font-size: 0.8rem; color: #94a3b8; }
.host-badge { background: #f59e0b; color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
.settings-section {
  background: #1e293b;
  padding: 1rem 1.5rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
}
.settings-section p { margin: 0.3rem 0; }
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-action {
  padding: 0.7rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  background: #22c55e;
  color: #fff;
}
.btn-action:hover { opacity: 0.9; }
.btn-danger { background: #ef4444; }
.btn-start { background: #3b82f6; }
.error { color: #ef4444; margin-top: 1rem; }
</style>
