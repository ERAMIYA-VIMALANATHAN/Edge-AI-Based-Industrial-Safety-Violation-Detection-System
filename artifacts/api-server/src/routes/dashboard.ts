import { Router, type IRouter } from "express";
import { workers, alerts, cameras, zones, generateLiveFeed } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const activeWorkers = workers.filter(w => w.status === "active");
  const workersInHazard = activeWorkers.filter(w => w.currentZone !== null).length;

  const withHelmet = activeWorkers.filter(w => w.ppeStatus.hasHelmet).length;
  const withVest = activeWorkers.filter(w => w.ppeStatus.hasVest).length;
  const withMask = activeWorkers.filter(w => w.ppeStatus.hasMask).length;
  const total = activeWorkers.length || 1;

  const activeViolations = alerts.filter(a => a.status === "active").length;
  const activeCameras = cameras.filter(c => c.status === "online").length;

  res.json({
    totalWorkers: workers.length,
    workersInHazardZone: workersInHazard,
    helmetCompliance: Math.round((withHelmet / total) * 100),
    vestCompliance: Math.round((withVest / total) * 100),
    maskCompliance: Math.round((withMask / total) * 100),
    activeViolations,
    currentWorkerCount: activeWorkers.length,
    activeCameras,
    totalZones: zones.length,
  });
});

router.get("/dashboard/live-feed", async (_req, res): Promise<void> => {
  res.json(generateLiveFeed());
});

router.get("/dashboard/active-alerts", async (_req, res): Promise<void> => {
  const active = alerts
    .filter(a => a.status === "active" || a.status === "acknowledged")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
  res.json(active);
});

export default router;
