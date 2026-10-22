import app from "./app.js";
import { config } from "./config/env.js";
import { initTicketWorker } from "./workers/ticketWorker.js";

// Initialize background queue worker
initTicketWorker();

const server = app.listen(config.port, () => {
  console.log(
    `[PulseEngine] Server running on port ${config.port} in ${config.nodeEnv} mode`,
  );
});
