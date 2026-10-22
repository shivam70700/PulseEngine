import { Server } from "socket.io";

let io = null;

/**
 * Initialize Socket.io with HTTP server instance
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get the initialized Socket.io instance
 * @returns {Server|null}
 */
export const getIO = () => {
  return io;
};

export default {
  initSocket,
  getIO,
};
