<template>
  <div class="players-panel">
    <h3>Игроки</h3>
    <div v-for="(p, idx) in sortedPlayers" :key="p.user_id" class="player-row" :class="{ active: isCurrentPlayer(p), bankrupt: p.is_bankrupt, inactive: !p.is_active }">
      <div class="chip" :style="{ background: p.chip_color || '#666' }"></div>
      <div class="player-info">
        <span class="name">{{ p.username || 'Игрок' }}</span>
        <span class="balance">{{ p.balance }}$</span>
      </div>
      <span v-if="p.in_jail" class="jail-badge">🔒</span>
      <span v-if="p.is_bankrupt" class="bankrupt-badge">💀</span>
      <span v-if="isCurrentPlayer(p)" class="arrow">◄</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  players: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 },
});

const sortedPlayers = computed(() => {
  return [...props.players].sort((a, b) => a.turn_order - b.turn_order);
});

function isCurrentPlayer(p) {
  const active = props.players.filter(pl => pl.is_active && !pl.is_bankrupt);
  if (active.length === 0) return false;
  const idx = props.currentIndex % active.length;
  return active[idx]?.user_id === p.user_id;
}
</script>

<style scoped>
.players-panel {
  background: #1e293b;
  padding: 0.75rem 1rem;
  border-radius: 10px;
}
.players-panel h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #94a3b8; }
.player-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.25rem;
}
.player-row.active { background: #22c55e22; border: 1px solid #22c55e44; }
.player-row.bankrupt { opacity: 0.4; text-decoration: line-through; }
.player-row.inactive { opacity: 0.3; }
.chip { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.player-info { flex: 1; display: flex; justify-content: space-between; }
.name { font-weight: 600; font-size: 0.9rem; }
.balance { color: #22c55e; font-size: 0.85rem; }
.jail-badge, .bankrupt-badge { font-size: 0.8rem; }
.arrow { color: #22c55e; font-weight: 700; }
</style>
