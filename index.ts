import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
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

    // initialize room array
    if (!rooms[roomId]) rooms[roomId] = [];
    if (!rooms[roomId].includes(socket.id)) rooms[roomId].push(socket.id);

    // assign a random Pokemon name
    const name = getRandomName(Object.values(userNames));
    userNames[socket.id] = name;
    console.log(`👤 ${socket.id} assigned name: ${name}`);

    // send back all existing users (id + name)
    const otherUsers = rooms[roomId]
      .filter((id) => id !== socket.id)
      .map((id) => ({ userId: id, userName: userNames[id] }));
    console.log(`📦 Emitting all-users to ${socket.id}:`, otherUsers);
    socket.emit("all-users", otherUsers);

    // notify the room that someone joined
    socket.to(roomId).emit("user-joined-room", {
      userId: socket.id,
      userName: name,
    });
    console.log(`📣 Broadcasted join of ${socket.id} to room ${roomId}`);
  });

  socket.on(
    "sending-signal",
    (payload: { userToSignal: string; signal: any; callerId?: string }) => {
      console.log(`📡 ${socket.id} sending signal to ${payload.userToSignal}`);
      io.to(payload.userToSignal).emit("user-joined", {
        signal: payload.signal,
        callerId: socket.id,
      });
    }
  );

  socket.on(
    "returning-signal",
    (payload: { signal: any; callerId: string }) => {
      console.log(`📶 ${socket.id} returning signal to ${payload.callerId}`);
      io.to(payload.callerId).emit("receiving-returned-signal", {
        signal: payload.signal,
        id: socket.id,
      });
    }
  );

  socket.on("chat-message", (msg: string) => {
    const name = userNames[socket.id] || "Unknown";
    for (const roomId in rooms) {
      if (rooms[roomId].includes(socket.id)) {
        io.to(roomId).emit("chat-message", `${name}: ${msg}`);
        console.log(`💬 ${name} in ${roomId}: "${msg}"`);
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const idx = rooms[roomId].indexOf(socket.id);
      if (idx !== -1) {
        rooms[roomId].splice(idx, 1);
        socket.to(roomId).emit("user-left", socket.id);
        console.log(`📤 ${socket.id} left room ${roomId}`);
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
          console.log(`🧹 Cleaned empty room ${roomId}`);
        }
      }
    }
    delete userNames[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Signaling server listening on http://localhost:${PORT}`);
});
