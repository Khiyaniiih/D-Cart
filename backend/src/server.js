import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { initializeSocketServer } from "./realtime/socket.js";

const startServer = async () => {
  try {
    await prisma.$connect();
    const httpServer = createServer(app);
    initializeSocketServer(httpServer);

    httpServer.listen(env.port, () => {
      console.log(`D'Cart backend listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend server:", error);
    process.exit(1);
  }
};

startServer();
