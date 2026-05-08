import { defineStore } from 'pinia';
import api from '../services/api';

export const useGameStore = defineStore('game', {
  state: () => ({
    gameState: null,
    lastDice: null,
    lastCellResult: null,
    chatMessages: [],
    exitVoteActive: false,
    auctionData: null,
    loading: false,
    error: null,
  }),
  getters: {
    currentPlayer: (state) => {
      if (!state.gameState) return null;
      const active = state.gameState.players.filter(p => p.is_active && !p.is_bankrupt);
      if (active.length === 0) return null;
      const idx = state.gameState.current_player_index % active.length;
      return active[idx];
    },
    isMyTurn: (state) => {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (!state.gameState || !user) return false;
      const active = state.gameState.players.filter(p => p.is_active && !p.is_bankrupt);
      if (active.length === 0) return false;
      const idx = state.gameState.current_player_index % active.length;
      return active[idx]?.user_id === user.id;
    },
    myPlayer: (state) => {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (!state.gameState || !user) return null;
      return state.gameState.players.find(p => p.user_id === user.id);
    },
  },
  actions: {
    setGameState(gs) {
      this.gameState = gs;
    },
    async fetchGameState(sessionId) {
      this.loading = true;
      try {
        const res = await api.get(`/api/game/${sessionId}/state`);
        this.gameState = res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка загрузки';
      } finally {
        this.loading = false;
      }
    },
    async rollDice(sessionId) {
      this.loading = true;
      try {
        const res = await api.post(`/api/game/${sessionId}/roll`);
        this.lastDice = res.data.dice;
        this.lastCellResult = res.data.cell_result;
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async buyProperty(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/buy`);
        this.gameState = res.data.game_state;
        this.lastCellResult = null;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async startAuction(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/auction/start`);
        this.auctionData = res.data.auction;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async placeBid(sessionId, cellPosition, amount) {
      try {
        const res = await api.post(`/api/game/${sessionId}/auction/bid`, { cell_position: cellPosition, amount });
        this.gameState = res.data.game_state;
        this.auctionData = null;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async skipAuction(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/auction/skip`);
        this.gameState = res.data.game_state;
        this.auctionData = null;
        this.lastCellResult = null;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async jailPay(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/jail/pay`);
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async jailRoll(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/jail/roll`);
        this.lastDice = res.data.result?.dice;
        this.lastCellResult = res.data.cell_result || null;
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async locationMove(sessionId, targetPosition) {
      try {
        const res = await api.post(`/api/game/${sessionId}/location/move`, { target_position: targetPosition });
        this.lastCellResult = res.data.cell_result || null;
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async locationSkip(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/location/skip`);
        this.gameState = res.data.game_state;
        this.lastCellResult = null;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async voteExit(sessionId, agree) {
      try {
        const res = await api.post(`/api/game/${sessionId}/exit/vote`, { agree_to_exit: agree });
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    async leaveGame(sessionId) {
      try {
        const res = await api.post(`/api/game/${sessionId}/exit/leave`);
        this.gameState = res.data.game_state;
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.error || 'Ошибка';
        throw err;
      }
    },
    addChatMessage(msg) {
      this.chatMessages.push(msg);
      if (this.chatMessages.length > 100) this.chatMessages.shift();
    },
    clearError() {
      this.error = null;
    },
  },
});
