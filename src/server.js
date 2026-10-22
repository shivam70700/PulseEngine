import http from "http";
import app from "./app.js";
import { config } from "./config/env.js";
import { initTicketWorker } from "./workers/ticketWorker.js";
import { initSocket } from "./config/socket.js";

// Wrap Express app in an HTTP server
const httpServer = http.createServer(app);

// Attach Socket.io server with CORS enabled
initSocket(httpServer);

// Initialize background queue worker
initTicketWorker();

httpServer.listen(config.port, () => {
  console.log(
    `[PulseEngine] Server running on port ${config.port} in ${config.nodeEnv} mode`,
  );
});

export default httpServer;
