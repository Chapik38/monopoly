import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/rooms' },
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'Register', component: () => import('../views/RegisterView.vue') },
  { path: '/rooms', name: 'Rooms', component: () => import('../views/RoomsView.vue'), meta: { requiresAuth: true } },
  { path: '/rooms/:id', name: 'RoomDetail', component: () => import('../views/RoomDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/game/:sessionId', name: 'Game', component: () => import('../views/GameView.vue'), meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else if ((to.name === 'Login' || to.name === 'Register') && token) {
    next('/rooms');
  } else {
    next();
  }
});

export default router;
