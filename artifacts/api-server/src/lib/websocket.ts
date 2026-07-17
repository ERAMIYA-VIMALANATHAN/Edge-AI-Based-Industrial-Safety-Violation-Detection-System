import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { logger } from "./logger";
import { generateLiveFeed, getLiveSensorReadings, alerts } from "./mock-data";

let wss: WebSocketServer | null = null;

function broadcast(data: unknown) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    logger.info("WebSocket client connected");

    // Send initial state immediately
    ws.send(JSON.stringify({ type: "live_feed", data: generateLiveFeed() }));
    ws.send(JSON.stringify({ type: "sensors", data: getLiveSensorReadings() }));
    ws.send(JSON.stringify({
      type: "active_alerts",
      data: alerts.filter(a => a.status === "active" || a.status === "acknowledged"),
    }));

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  // Broadcast live updates every 3 seconds
  setInterval(() => {
    broadcast({ type: "live_feed", data: generateLiveFeed() });
  }, 3000);

  // Broadcast sensor updates every 5 seconds
  setInterval(() => {
    broadcast({ type: "sensors", data: getLiveSensorReadings() });
  }, 5000);

  // Broadcast alert updates every 10 seconds
  setInterval(() => {
    broadcast({
      type: "active_alerts",
      data: alerts.filter(a => a.status === "active" || a.status === "acknowledged"),
    });
  }, 10000);

  logger.info("WebSocket server set up at /ws");
}

export { broadcast };
