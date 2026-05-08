<template>
  <div class="rooms-page">
    <header class="top-bar">
      <h1>Быстрая Монополия</h1>
      <div class="user-info">
        <span>{{ authStore.user?.username }}</span>
        <button class="btn-sm" @click="logout">Выйти</button>
      </div>
    </header>

    <div class="rooms-content">
      <div class="create-section">
        <h2>Создать комнату</h2>
        <form @submit.prevent="createRoom">
          <input v-model="newRoom.name" placeholder="Название комнаты" required />
          <select v-model="newRoom.max_players">
            <option :value="2">2 игрока</option>
            <option :value="3">3 игрока</option>
            <option :value="4">4 игрока</option>
            <option :value="5">5 игроков</option>
            <option :value="6">6 игроков</option>
          </select>
          <input v-model.number="newRoom.starting_capital" type="number" placeholder="Стартовый капитал" min="500" />
          <button type="submit">Создать</button>
        </form>
      </div>

      <div class="rooms-list">
        <h2>Доступные комнаты</h2>
        <button class="btn-sm refresh-btn" @click="loadRooms">Обновить</button>
        <p v-if="error" class="error">{{ error }}</p>
        <div v-if="rooms.length === 0" class="empty">Нет доступных комнат</div>
        <div v-for="room in rooms" :key="room.id" class="room-card" @click="goToRoom(room.id)">
          <div class="room-info">
            <h3>{{ room.name }}</h3>
            <span class="room-players">{{ room.player_count || 0 }} / {{ room.max_players }}</span>
          </div>
          <div class="room-meta">
            <span>Капитал: {{ room.starting_capital }}$</span>
            <span :class="'status-' + room.status">{{ statusText(room.status) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

const router = useRouter();
const authStore = useAuthStore();

const rooms = ref([]);
const error = ref('');
const newRoom = ref({ name: '', max_players: 4, starting_capital: 1500 });

async function loadRooms() {
  try {
    const res = await api.get('/api/rooms');
    rooms.value = res.data;
  } catch (err) {
    error.value = 'Ошибка загрузки комнат';
  }
}

async function createRoom() {
  try {
    const res = await api.post('/api/rooms', newRoom.value);
    router.push(`/rooms/${res.data.room.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка создания';
  }
}

function goToRoom(id) {
  router.push(`/rooms/${id}`);
}

function statusText(s) {
  return s === 'waiting' ? 'Ожидание' : s === 'playing' ? 'В игре' : 'Завершена';
}

function logout() {
  authStore.logout();
  router.push('/login');
}

onMounted(loadRooms);
</script>

<style scoped>
.rooms-page {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}
.top-bar h1 { color: #22c55e; font-size: 1.3rem; margin: 0; }
.user-info { display: flex; align-items: center; gap: 1rem; }
.btn-sm {
  padding: 0.4rem 1rem;
  background: #334155;
  color: #e2e8f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-sm:hover { background: #475569; }
.rooms-content {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.create-section {
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}
.create-section h2 { margin-top: 0; color: #22c55e; }
.create-section form {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.create-section input, .create-section select {
  padding: 0.6rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.95rem;
  flex: 1;
  min-width: 120px;
}
.create-section button {
  padding: 0.6rem 1.5rem;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.rooms-list h2 { color: #e2e8f0; }
.refresh-btn { margin-bottom: 1rem; }
.room-card {
  background: #1e293b;
  padding: 1rem 1.5rem;
  border-radius: 10px;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}
.room-card:hover { background: #334155; }
.room-info { display: flex; justify-content: space-between; align-items: center; }
.room-info h3 { margin: 0; font-size: 1.1rem; }
.room-players { color: #94a3b8; }
.room-meta { display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.85rem; color: #94a3b8; }
.status-waiting { color: #22c55e; }
.status-playing { color: #f59e0b; }
.status-finished { color: #ef4444; }
.empty { text-align: center; padding: 2rem; color: #64748b; }
.error { color: #ef4444; }
</style>
