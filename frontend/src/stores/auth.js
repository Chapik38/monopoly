import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async register(username, password, avatar) {
      const res = await api.post('/api/auth/register', { username, password, avatar });
      this.token = res.data.access_token;
      this.user = res.data.user;
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));
      return res.data;
    },
    async login(username, password) {
      const res = await api.post('/api/auth/login', { username, password });
      this.token = res.data.access_token;
      this.user = res.data.user;
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));
      return res.data;
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    async fetchMe() {
      const res = await api.get('/api/auth/me');
      this.user = res.data;
      localStorage.setItem('user', JSON.stringify(this.user));
    },
  },
});
