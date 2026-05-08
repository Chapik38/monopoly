<template>
  <div class="board">
    <!-- Top row (cells 20-30) -->
    <div class="board-row top-row">
      <div v-for="i in 11" :key="'t'+i" class="cell" :class="cellClass(20 + i - 1)" :style="cellStyle(20 + i - 1)">
        <div class="cell-name">{{ getCellName(20 + i - 1) }}</div>
        <div class="cell-price" v-if="getCellPrice(20 + i - 1)">{{ getCellPrice(20 + i - 1) }}$</div>
        <div class="cell-owner" v-if="getOwnerColor(20 + i - 1)" :style="{ background: getOwnerColor(20 + i - 1) }"></div>
        <div class="players-on-cell">
          <span v-for="p in playersOnCell(20 + i - 1)" :key="p.user_id" class="token" :style="{ background: p.chip_color || '#888' }">
            {{ (p.username || '?')[0] }}
          </span>
        </div>
      </div>
    </div>

    <div class="board-middle">
      <!-- Left column (cells 19 down to 11) -->
      <div class="board-col left-col">
        <div v-for="i in 9" :key="'l'+i" class="cell" :class="cellClass(20 - i)" :style="cellStyle(20 - i)">
          <div class="cell-name">{{ getCellName(20 - i) }}</div>
          <div class="cell-price" v-if="getCellPrice(20 - i)">{{ getCellPrice(20 - i) }}$</div>
          <div class="cell-owner" v-if="getOwnerColor(20 - i)" :style="{ background: getOwnerColor(20 - i) }"></div>
          <div class="players-on-cell">
            <span v-for="p in playersOnCell(20 - i)" :key="p.user_id" class="token" :style="{ background: p.chip_color || '#888' }">
              {{ (p.username || '?')[0] }}
            </span>
          </div>
        </div>
      </div>

      <!-- Center area -->
      <div class="board-center">
        <div class="center-title">БЫСТРАЯ<br/>МОНОПОЛИЯ</div>
      </div>

      <!-- Right column (cells 31-39) -->
      <div class="board-col right-col">
        <div v-for="i in 9" :key="'r'+i" class="cell" :class="cellClass(30 + i)" :style="cellStyle(30 + i)">
          <div class="cell-name">{{ getCellName(30 + i) }}</div>
          <div class="cell-price" v-if="getCellPrice(30 + i)">{{ getCellPrice(30 + i) }}$</div>
          <div class="cell-owner" v-if="getOwnerColor(30 + i)" :style="{ background: getOwnerColor(30 + i) }"></div>
          <div class="players-on-cell">
            <span v-for="p in playersOnCell(30 + i)" :key="p.user_id" class="token" :style="{ background: p.chip_color || '#888' }">
              {{ (p.username || '?')[0] }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom row (cells 10 down to 0) -->
    <div class="board-row bottom-row">
      <div v-for="i in 11" :key="'b'+i" class="cell" :class="cellClass(10 - (i - 1))" :style="cellStyle(10 - (i - 1))">
        <div class="cell-name">{{ getCellName(10 - (i - 1)) }}</div>
        <div class="cell-price" v-if="getCellPrice(10 - (i - 1))">{{ getCellPrice(10 - (i - 1)) }}$</div>
        <div class="cell-owner" v-if="getOwnerColor(10 - (i - 1))" :style="{ background: getOwnerColor(10 - (i - 1)) }"></div>
        <div class="players-on-cell">
          <span v-for="p in playersOnCell(10 - (i - 1))" :key="p.user_id" class="token" :style="{ background: p.chip_color || '#888' }">
            {{ (p.username || '?')[0] }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  cells: { type: Array, default: () => [] },
  players: { type: Array, default: () => [] },
  properties: { type: Array, default: () => [] },
});

const COLOR_MAP = {
  brown: '#8B4513',
  light_blue: '#87CEEB',
  pink: '#FF69B4',
  orange: '#FF8C00',
  red: '#DC143C',
  yellow: '#FFD700',
  green: '#228B22',
  dark_blue: '#00008B',
  railroad: '#333',
};

function getCellByPos(pos) {
  return props.cells.find(c => c.position === pos) || null;
}

function getCellName(pos) {
  const c = getCellByPos(pos);
  if (!c) {
    const defaults = { 0: 'СТАРТ', 10: 'ТЮРЬМА', 20: 'ПАРКОВКА', 30: 'ИДИТЕ В ТЮРЬМУ' };
    return defaults[pos] || `#${pos}`;
  }
  return c.name || `#${pos}`;
}

function getCellPrice(pos) {
  const c = getCellByPos(pos);
  return c?.purchase_price || null;
}

function cellClass(pos) {
  const c = getCellByPos(pos);
  return c ? `type-${c.cell_type}` : '';
}

function cellStyle(pos) {
  const c = getCellByPos(pos);
  if (c?.color_group && COLOR_MAP[c.color_group]) {
    return { borderTopColor: COLOR_MAP[c.color_group] };
  }
  return {};
}

function getOwnerColor(pos) {
  const prop = props.properties.find(p => p.cell_position === pos);
  if (!prop || !prop.owner_id) return null;
  const owner = props.players.find(p => p.user_id === prop.owner_id);
  return owner?.chip_color || '#888';
}

function playersOnCell(pos) {
  return props.players.filter(p => p.position === pos && p.is_active && !p.is_bankrupt);
}
</script>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  width: 660px;
  min-width: 660px;
}
.board-row {
  display: flex;
}
.board-middle {
  display: flex;
}
.board-col {
  display: flex;
  flex-direction: column;
}
.board-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #1a2332;
  min-height: 300px;
}
.center-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #22c55e;
  text-align: center;
  line-height: 1.3;
}
.cell {
  width: 60px;
  height: 60px;
  background: #1e293b;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-size: 0.55rem;
  padding: 2px;
  border-top: 4px solid transparent;
  box-sizing: border-box;
}
.top-row .cell, .bottom-row .cell { width: 60px; }
.left-col .cell, .right-col .cell { width: 60px; height: 42px; }
.cell-name {
  text-align: center;
  line-height: 1.1;
  color: #e2e8f0;
  font-weight: 600;
  max-height: 24px;
  overflow: hidden;
}
.cell-price { color: #22c55e; font-size: 0.5rem; }
.cell-owner {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.players-on-cell {
  display: flex;
  gap: 1px;
  position: absolute;
  bottom: 4px;
  left: 2px;
}
.token {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.45rem;
  color: #fff;
  font-weight: 700;
}
.type-go { background: #166534; }
.type-jail { background: #7c3aed33; }
.type-parking { background: #92400e33; }
.type-go_to_jail { background: #7c3aed44; }
.type-tax { background: #991b1b33; }
.type-event { background: #0e749022; }
.type-location { background: #4338ca22; }
</style>
