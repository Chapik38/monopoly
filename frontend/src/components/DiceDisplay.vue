<template>
  <div class="dice-display">
    <div class="die">{{ dice.die1 }}</div>
    <div class="die">{{ dice.die2 }}</div>
    <span class="total">= {{ dice.total }}</span>
    <span v-if="dice.is_double" class="double">Дубль!</span>
  </div>
</template>

<script setup>
defineProps({
  dice: { type: Object, required: true },
});
</script>

<style scoped>
.dice-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  padding: 0.6rem 1rem;
  border-radius: 10px;
}
.die {
  width: 36px;
  height: 36px;
  background: #fff;
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 1.2rem;
  font-weight: 800;
}
.total { color: #e2e8f0; font-weight: 600; }
.double { color: #f59e0b; font-weight: 700; font-size: 0.9rem; }
</style>
