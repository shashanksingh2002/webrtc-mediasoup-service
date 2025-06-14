import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Health check route
app.get("/health", (_, res) => {
  res.status(200).json({ message: "Service is up and running 🚀" });
});

// Types
interface SignalPayload {
  userToSignal: string;
  signal: any;
  callerId?: string;
}

interface ReturningSignalPayload {
  signal: any;
  callerId: string;
}

interface Rooms {
  [roomId: string]: string[];
}

const rooms: Rooms = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join-room", (roomId: string) => {
    console.log(`➡️  ${socket.id} joining room ${roomId}`);

    socket.join(roomId); // Optional for future room-wide broadcasts

    if (!rooms[roomId]) rooms[roomId] = [];

    if (!rooms[roomId].includes(socket.id)) {
      rooms[roomId].push(socket.id);
    }

    const otherUsers = rooms[roomId].filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);
  });

  socket.on("sending-signal", (payload: SignalPayload) => {
    console.log(`📤 ${socket.id} sending signal to ${payload.userToSignal}`);
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerId: socket.id,
    });
  });

  socket.on("returning-signal", (payload: ReturningSignalPayload) => {
    console.log(`📥 ${socket.id} returning signal to ${payload.callerId}`);
    io.to(payload.callerId).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Room ${roomId} cleaned up`);
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ WebRTC signaling server running at http://localhost:${PORT}`);
});
