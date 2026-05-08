<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Быстрая Монополия</h1>
      <h2>Вход</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Имя пользователя</label>
          <input v-model="username" type="text" required placeholder="Введите имя" />
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input v-model="password" type="password" required placeholder="Введите пароль" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? 'Вход...' : 'Войти' }}</button>
      </form>
      <p class="link">Нет аккаунта? <router-link to="/register">Зарегистрироваться</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await authStore.login(username.value, password.value);
    router.push('/rooms');
  } catch (err) {
    error.value = err.response?.data?.error || 'Ошибка входа';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
}
.auth-card {
  background: #1e293b;
  padding: 2.5rem;
  border-radius: 16px;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.auth-card h1 {
  color: #22c55e;
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}
.auth-card h2 {
  color: #e2e8f0;
  text-align: center;
  margin-bottom: 1.5rem;
  font-weight: 400;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  color: #94a3b8;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}
.form-group input {
  width: 100%;
  padding: 0.7rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 1rem;
  box-sizing: border-box;
}
.form-group input:focus {
  outline: none;
  border-color: #22c55e;
}
.error {
  color: #ef4444;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
button {
  width: 100%;
  padding: 0.75rem;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}
button:hover {
  background: #16a34a;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.link {
  text-align: center;
  margin-top: 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
}
.link a {
  color: #22c55e;
  text-decoration: none;
}
</style>
