// server.js
// Core principle from the blueprint: Message -> Encrypt (Device) -> Server/Relay -> Receiver -> Decrypt (Device)
// This server NEVER sees plaintext. It only stores/forwards ciphertext + nonce.

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const db = require('./db');
const { router: authRouter, JWT_SECRET } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../public'));
app.use('/auth', authRouter);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Track which socket belongs to which handle (for online delivery)
const onlineUsers = new Map(); // handle -> socket.id

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('no token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.handle = decoded.handle;
    next();
  } catch (err) {
    next(new Error('invalid token'));
  }
});

io.on('connection', (socket) => {
  const handle = socket.handle;
  onlineUsers.set(handle, socket.id);
  console.log(`[+] ${handle} connected`);

  // Send any queued (undelivered) messages - Priority 4 in blueprint: fail-safe queue
  const queued = db.prepare(
    'SELECT * FROM messages WHERE to_handle = ? AND delivered = 0 ORDER BY created_at ASC'
  ).all(handle);

  queued.forEach((msg) => {
    socket.emit('message', {
      from: msg.from_handle,
      ciphertext: msg.ciphertext,
      nonce: msg.nonce,
      timestamp: msg.created_at,
    });
    db.prepare('UPDATE messages SET delivered = 1 WHERE id = ?').run(msg.id);
  });

  // Client sends: { to, ciphertext, nonce }
  socket.on('send_message', ({ to, ciphertext, nonce }) => {
    if (!to || !ciphertext || !nonce) return;

    // Always store first (Zero Message Loss Strategy from blueprint)
    const info = db.prepare(
      'INSERT INTO messages (from_handle, to_handle, ciphertext, nonce, delivered) VALUES (?, ?, ?, ?, 0)'
    ).run(handle, to, ciphertext, nonce);

    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('message', {
        from: handle,
        ciphertext,
        nonce,
        timestamp: new Date().toISOString(),
      });
      db.prepare('UPDATE messages SET delivered = 1 WHERE id = ?').run(info.lastInsertRowid);
      socket.emit('message_status', { id: info.lastInsertRowid, status: 'delivered' });
    } else {
      socket.emit('message_status', { id: info.lastInsertRowid, status: 'queued' });
    }
  });

  socket.on('typing', ({ to, isTyping }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('typing', { from: handle, isTyping });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(handle);
    console.log(`[-] ${handle} disconnected`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Private Messenger server running on port ${PORT}`);
});
