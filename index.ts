import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.get("/health", (_, res) => {
  res.status(200).json({ message: "Service is up and running 🚀" });
});

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
  socket.on("join-room", (roomId: string) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    const otherUsers: string[] = rooms[roomId].filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);

    socket.on("sending-signal", (payload: SignalPayload) => {
      io.to(payload.userToSignal).emit("user-joined", {
        signal: payload.signal,
        callerId: socket.id,
      });
    });

    socket.on("returning-signal", (payload: ReturningSignalPayload) => {
      io.to(payload.callerId).emit("receiving-returned-signal", {
        signal: payload.signal,
        id: socket.id,
      });
    });

    socket.on("disconnect", () => {
      rooms[roomId] = rooms[roomId]?.filter((id) => id !== socket.id);
    });
  });
});

// Start server with env-based fallback
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ WebRTC signaling server running at http://localhost:${PORT}`);
});
