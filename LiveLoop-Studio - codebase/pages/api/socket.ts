import type { NextApiRequest, NextApiResponse } from "next";
import { Server as NetServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

// Types
interface ServerWithIO extends NetServer {
  io?: SocketIOServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: any & { server: ServerWithIO };
}

// In-memory room store (ephemeral)
const rooms: Record<string, Set<string>> = {};

function setupSocket(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    // Join a session room
    socket.on("room:join", ({ roomId, userId }) => {
      socket.join(roomId);
      (rooms[roomId] ||= new Set()).add(socket.id);
      io.to(roomId).emit("room:peers", Array.from(rooms[roomId]));
      socket.to(roomId).emit("system", { type: "join", userId, socketId: socket.id });
    });

    // Leave a session room
    const leaveAll = () => {
      const joined = Array.from(socket.rooms);
      joined.forEach((roomId) => {
        if (roomId === socket.id) return;
        socket.leave(roomId);
        if (rooms[roomId]) {
          rooms[roomId].delete(socket.id);
          if (rooms[roomId].size === 0) delete rooms[roomId];
          io.to(roomId).emit("room:peers", Array.from(rooms[roomId] || []));
          socket.to(roomId).emit("system", { type: "leave", socketId: socket.id });
        }
      });
    };

    socket.on("disconnect", () => {
      leaveAll();
    });

    // WebRTC signaling
    socket.on("signal", ({ roomId, targetId, data }) => {
      io.to(targetId).emit("signal", { from: socket.id, data, roomId });
    });

    // Session state updates
    socket.on("transport:update", ({ roomId, state }) => {
      socket.to(roomId).emit("transport:update", { state, from: socket.id });
    });
    socket.on("loop:update", ({ roomId, loopId, payload }) => {
      socket.to(roomId).emit("loop:update", { loopId, payload, from: socket.id });
    });
    socket.on("seq:update", ({ roomId, grid }) => {
      socket.to(roomId).emit("seq:update", { grid, from: socket.id });
    });

    // Simple chat/notes
    socket.on("chat", ({ roomId, message, user }) => {
      socket.to(roomId).emit("chat", { message, user, at: Date.now() });
    });
  });
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const httpServer: ServerWithIO = res.socket.server;
    const io = new SocketIOServer(httpServer, {
      path: "/api/socket_io", // custom path
      addTrailingSlash: false,
      cors: {
        origin: "*",
      },
    });
    res.socket.server.io = io;
    setupSocket(io);
  }
  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};