const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 💡 Servir les fichiers statiques
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = {}; // { roomName: { password, players: [], ready: [] } }

io.on("connection", (socket) => {
  socket.on("createRoom", ({ pseudo, roomName, roomPass }) => {
    if (rooms[roomName]) {
      socket.emit("roomExists");
      return;
    }
    rooms[roomName] = {
      password: roomPass,
      players: [{ id: socket.id, pseudo }],
      ready: [],
    };
    socket.join(roomName);
    socket.emit("roomCreated", roomName);
  });

  socket.on("joinRoom", ({ pseudo, roomName, roomPass }) => {
    const room = rooms[roomName];
    if (!room) {
      socket.emit("roomNotFound");
      return;
    }
    if (room.password && room.password !== roomPass) {
      socket.emit("wrongPassword");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("roomFull");
      return;
    }
    room.players.push({ id: socket.id, pseudo });
    socket.join(roomName);
    io.to(roomName).emit("bothPlayersJoined", room.players.map(p => ({
      ...p,
      roomName,
    })));

  });

  socket.on("playerReady", (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    if (!room.ready.includes(socket.id)) room.ready.push(socket.id);
    if (room.ready.length === 2) {
      const startAt = Date.now() + 3000;
      io.to(roomName).emit("startCountdown", { startAt });
    }
  });

  socket.on("angleUpdate", ({ roomName, angle, clicks }) => {
    socket.to(roomName).emit("enemyAngle", { id: socket.id, angle, clicks });
  });

  socket.on("win", (roomName) => {
    io.to(roomName).emit("gameOver", socket.id);
  });

  socket.on("replay", (roomName) => {
    if (rooms[roomName]) {
      rooms[roomName].ready = [];
      io.to(roomName).emit("resetGame");
    }
  });

  socket.on("leaveRoom", (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    socket.leave(roomName);
    room.players = room.players.filter(p => p.id !== socket.id);
    room.ready = room.ready.filter(id => id !== socket.id);
    io.to(roomName).emit("playerLeft");
    if (room.players.length === 0) delete rooms[roomName];
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      room.players = room.players.filter(p => p.id !== socket.id);
      room.ready = room.ready.filter(id => id !== socket.id);
      io.to(roomName).emit("playerLeft");
      if (room.players.length === 0) delete rooms[roomName];
    }
  });
});

server.listen(3000, () => console.log("🚀 http://localhost:3000"));
