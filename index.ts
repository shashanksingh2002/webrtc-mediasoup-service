import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/health", (_, res) => {
  res.status(200).json({ message: "Service is up and running 🚀" });
});

const POKEMON_NAMES = [
  "Pikachu",
  "Charmander",
  "Bulbasaur",
  "Squirtle",
  "Jigglypuff",
  "Meowth",
  "Psyduck",
  "Snorlax",
  "Gengar",
  "Eevee",
  "Vulpix",
  "Machop",
  "Gastly",
  "Onix",
  "Lapras",
];

function getRandomName(existing: string[]) {
  const unused = POKEMON_NAMES.filter((n) => !existing.includes(n));
  return unused.length
    ? unused[Math.floor(Math.random() * unused.length)]
    : `Trainer${Date.now()}`;
}

interface Rooms {
  [roomId: string]: string[]; // socket.id[]
}

interface UserNames {
  [socketId: string]: string;
}

const rooms: Rooms = {};
const userNames: UserNames = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join-room", (roomId: string) => {
    console.log(`➡️ ${socket.id} joining ${roomId}`);
    socket.join(roomId);

    // Add to room
    if (!rooms[roomId]) rooms[roomId] = [];
    if (!rooms[roomId].includes(socket.id)) {
      rooms[roomId].push(socket.id);
    }

    // Assign unique name
    const currentNames = Object.values(userNames);
    const name = getRandomName(currentNames);
    userNames[socket.id] = name;

    // Notify new user of existing users
    const otherUsers = rooms[roomId].filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);

    // Notify others about the new user
    socket.to(roomId).emit("user-joined-room", {
      userId: socket.id,
      userName: name,
    });
  });

  socket.on("sending-signal", (payload) => {
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerId: socket.id,
    });
  });

  socket.on("returning-signal", (payload) => {
    io.to(payload.callerId).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("chat-message", (msg: string) => {
    const name = userNames[socket.id] || "Unknown";
    const message = `${name}: ${msg}`;
    for (const roomId in rooms) {
      if (rooms[roomId].includes(socket.id)) {
        io.to(roomId).emit("chat-message", message);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Cleaned empty room ${roomId}`);
      } else {
        io.to(roomId).emit("user-left", socket.id);
      }
    }
    delete userNames[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Signaling server listening on http://localhost:${PORT}`);
});
