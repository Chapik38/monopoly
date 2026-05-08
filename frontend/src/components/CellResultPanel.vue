<template>
  <div class="cell-result-panel">
    <!-- Property can be bought -->
    <template v-if="result.type === 'property_available'">
      <h3>{{ result.cell_name }}</h3>
      <p>Цена: {{ result.price }}$</p>
      <p v-if="result.color_group">Группа: {{ colorGroupName(result.color_group) }}</p>
      <div class="actions">
        <button @click="buyProperty">Купить</button>
        <button class="btn-secondary" @click="startAuction">Аукцион</button>
        <button class="btn-secondary" @click="skipAction">Пропустить</button>
      </div>
    </template>

    <!-- Rent paid -->
    <template v-else-if="result.type === 'rent_paid'">
      <h3>Аренда: {{ result.cell_name }}</h3>
      <p>Оплачено: {{ result.amount }}$ владельцу {{ result.owner_name }}</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Tax -->
    <template v-else-if="result.type === 'tax'">
      <h3>Налог: {{ result.cell_name }}</h3>
      <p>Оплачено: {{ result.amount }}$</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Event card -->
    <template v-else-if="result.type === 'event_card'">
      <h3>Карточка события</h3>
      <p class="card-title">{{ result.card_title }}</p>
      <p>{{ result.card_description }}</p>
      <p v-if="result.effect">{{ result.effect }}</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Location card -->
    <template v-else-if="result.type === 'location_card'">
      <h3>Карточка местоположения</h3>
      <p class="card-title">{{ result.card_title }}</p>
      <p>{{ result.card_description }}</p>
      <p>Стоимость перемещения: 100$</p>
      <div class="location-options" v-if="result.target_positions">
        <p>Выберите клетку для перемещения:</p>
        <div class="location-buttons">
          <button v-for="pos in result.target_positions" :key="pos" @click="moveToLocation(pos)">
            Клетка {{ pos }}
          </button>
        </div>
      </div>
      <button class="btn-secondary" @click="skipLocation">Отказаться</button>
    </template>

    <!-- Go to jail -->
    <template v-else-if="result.type === 'go_to_jail'">
      <h3>Идите в тюрьму!</h3>
      <p>Вы отправлены в тюрьму.</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Passed GO -->
    <template v-else-if="result.type === 'passed_go'">
      <h3>Вы прошли СТАРТ!</h3>
      <p>Получено: 200$</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Own property -->
    <template v-else-if="result.type === 'own_property'">
      <h3>{{ result.cell_name }}</h3>
      <p>Это ваша собственность.</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Bankruptcy -->
    <template v-else-if="result.type === 'bankruptcy'">
      <h3>Банкротство!</h3>
      <p>{{ result.message || 'Вы обанкротились.' }}</p>
      <button @click="skipAction">Ок</button>
    </template>

    <!-- Default -->
    <template v-else>
      <p>{{ result.message || 'Действие выполнено' }}</p>
      <button @click="skipAction">Ок</button>
    </template>
  </div>
</template>

<script setup>
import { useGameStore } from '../stores/game';

const props = defineProps({
  result: { type: Object, required: true },
  sessionId: { type: [String, Number], required: true },
});

const emit = defineEmits(['action-done']);
const gameStore = useGameStore();

const colorNames = {
  brown: 'Коричневая',
  light_blue: 'Голубая',
  pink: 'Розовая',
  orange: 'Оранжевая',
  red: 'Красная',
  yellow: 'Жёлтая',
  green: 'Зелёная',
  dark_blue: 'Тёмно-синяя',
  railroad: 'Железная дорога',
};

function colorGroupName(group) {
  return colorNames[group] || group;
}

async function buyProperty() {
  await gameStore.buyProperty(props.sessionId);
  emit('action-done');
}

async function startAuction() {
  await gameStore.startAuction(props.sessionId);
  emit('action-done');
}

async function moveToLocation(pos) {
  await gameStore.locationMove(props.sessionId, pos);
  emit('action-done');
}

async function skipLocation() {
  await gameStore.locationSkip(props.sessionId);
  emit('action-done');
}

function skipAction() {
  emit('action-done');
}
</script>

<style scoped>
.cell-result-panel h3 {
  margin: 0 0 0.5rem;
  color: #22c55e;
}
.cell-result-panel p { margin: 0.25rem 0; }
.card-title { font-weight: 700; color: #f59e0b; }
.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.cell-result-panel button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  background: #22c55e;
  color: #fff;
}
.btn-secondary { background: #334155; color: #e2e8f0; }
.cell-result-panel button:hover { opacity: 0.9; }
.location-options { margin: 0.5rem 0; }
.location-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
