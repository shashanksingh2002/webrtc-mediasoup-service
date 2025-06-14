import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);

// ─── Enable CORS with credentials ───────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      "https://qasr-three.vercel.app",
      "http://localhost:3000", // for local dev
    ],
    credentials: true,
  },
});

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
function getRandomName(existing: string[]): string {
  const unused = POKEMON_NAMES.filter((n) => !existing.includes(n));
  return unused.length
    ? unused[Math.floor(Math.random() * unused.length)]
    : `Trainer${Date.now()}`;
}

interface Rooms {
  [roomId: string]: string[];
}
interface UserNames {
  [socketId: string]: string;
}

const rooms: Rooms = {};
const userNames: UserNames = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Connected:", socket.id);

  // Log every incoming event
  socket.onAny((event, ...args) => {
    console.log("↪️ server got:", event, args);
  });

  socket.on("join-room", (roomId: string) => {
    console.log(`➡️ ${socket.id} requesting to join room ${roomId}`);
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];
    if (!rooms[roomId].includes(socket.id)) rooms[roomId].push(socket.id);

    // assign random name
    const name = getRandomName(Object.values(userNames));
    userNames[socket.id] = name;
    console.log(`👤 ${socket.id} assigned name: ${name}`);

    // send existing users
    const otherUsers = rooms[roomId]
      .filter((id) => id !== socket.id)
      .map((id) => ({ userId: id, userName: userNames[id] }));
    console.log(`📦 Emitting all-users to ${socket.id}:`, otherUsers);
    socket.emit("all-users", otherUsers);

    // notify rest
    socket.to(roomId).emit("user-joined-room", {
      userId: socket.id,
      userName: name,
    });
    console.log(`📣 Broadcasted join of ${socket.id} to room ${roomId}`);
  });

  socket.on("sending-signal", ({ userToSignal, signal, callerId }) => {
    console.log(`📡 ${socket.id} → signaling ${userToSignal}`);
    io.to(userToSignal).emit("user-joined", {
      signal,
      callerId: socket.id,
    });
  });

  socket.on("returning-signal", ({ signal, callerId }) => {
    console.log(`📶 ${socket.id} → returning signal to ${callerId}`);
    io.to(callerId).emit("receiving-returned-signal", {
      signal,
      id: socket.id,
    });
  });

  socket.on("chat-message", (msg: string) => {
    const name = userNames[socket.id] || "Unknown";
    for (const rid in rooms) {
      if (rooms[rid].includes(socket.id)) {
        io.to(rid).emit("chat-message", `${name}: ${msg}`);
        console.log(`💬 ${name} in ${rid}: "${msg}"`);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const rid in rooms) {
      const idx = rooms[rid].indexOf(socket.id);
      if (idx !== -1) {
        rooms[rid].splice(idx, 1);
        socket.to(rid).emit("user-left", socket.id);
        console.log(`📤 ${socket.id} left room ${rid}`);
        if (rooms[rid].length === 0) {
          delete rooms[rid];
          console.log(`🧹 Cleaned empty room ${rid}`);
        }
      }
    }
    delete userNames[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
  console.log(`✅ Signaling server listening on http://localhost:${PORT}`)
);
