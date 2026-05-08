const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const sequelize = require('./config/database');
require('./models');
const { setupSocket } = require('./services/socketHandler');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const gameRoutes = require('./routes/game');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.set('io', io);

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/game', gameRoutes);

setupSocket(io);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected');

    await sequelize.sync({ alter: true });
    console.log('Database synced');

    const { BoardCell, EventCard } = require('./models');
    const { boardCells, eventCards } = require('./data/board');

    const cellCount = await BoardCell.count();
    if (cellCount === 0) {
      await BoardCell.bulkCreate(boardCells);
      console.log('Board cells seeded');
    }

    const cardCount = await EventCard.count();
    if (cardCount === 0) {
      await EventCard.bulkCreate(eventCards);
      console.log('Event cards seeded');
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
