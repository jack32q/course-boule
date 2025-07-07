const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("createRoom", (pseudo) => {
    const roomId = randomUUID().slice(0, 6);
    rooms[roomId] = {
      players: [{ id: socket.id, pseudo }],
      ready: [],
    };
    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

  socket.on("joinRoom", ({ roomId, pseudo }) => {
    if (rooms[roomId] && rooms[roomId].players.length < 2) {
      rooms[roomId].players.push({ id: socket.id, pseudo });
      socket.join(roomId);
      io.to(roomId).emit("bothPlayersJoined", rooms[roomId].players);
    } else {
      socket.emit("roomFull");
    }
  });

  socket.on("playerReady", (roomId) => {
    rooms[roomId].ready.push(socket.id);
    if (rooms[roomId].ready.length === 2) {
      const startAt = Date.now() + 3000;
      io.to(roomId).emit("startCountdown", { startAt });
    }
  });

  socket.on("angleUpdate", ({ roomId, angle, clicks }) => {
    socket.to(roomId).emit("enemyAngle", {
      id: socket.id,
      angle,
      clicks
    });
  });


  socket.on("win", (roomId) => {
    io.to(roomId).emit("gameOver", socket.id);
  });

  socket.on("replay", (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].ready = [];
      io.to(roomId).emit("resetGame");
    }
  });

  socket.on("chatMessage", ({ roomId, pseudo, message }) => {
  socket.to(roomId).emit("chatMessage", { pseudo, message });
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      rooms[roomId].ready = rooms[roomId].ready.filter(id => id !== socket.id);
      io.to(roomId).emit("playerLeft");
      if (rooms[roomId].players.length === 0) delete rooms[roomId];
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      rooms[roomId].ready = rooms[roomId].ready.filter(id => id !== socket.id);
      io.to(roomId).emit("playerLeft");
      if (rooms[roomId].players.length === 0) delete rooms[roomId];
    }
  });
});

server.listen(3000, () => console.log("🚀 http://localhost:3000"));
