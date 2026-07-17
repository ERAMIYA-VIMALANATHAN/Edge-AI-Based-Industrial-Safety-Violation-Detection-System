import { Router, type IRouter } from "express";
import { workers, alerts, type Worker } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/workers", async (req, res): Promise<void> => {
  const { zone, status } = req.query as Record<string, string | undefined>;
  let result = [...workers];
  if (zone) result = result.filter(w => w.currentZone === zone);
  if (status) result = result.filter(w => w.status === status);
  res.json(result);
});

router.post("/workers", async (req, res): Promise<void> => {
  const { rfidId, name, department, status } = req.body ?? {};
  if (!rfidId || !name || !department) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const worker: Worker = {
    id: `w${Date.now()}`,
    rfidId,
    name,
    department,
    currentZone: null,
    ppeStatus: { hasHelmet: false, hasVest: false, hasMask: false },
    lastSeen: new Date().toISOString(),
    complianceRate: 100,
    totalViolations: 0,
    status: status ?? "active",
  };
  workers.push(worker);
  res.status(201).json(worker);
});

router.get("/workers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const worker = workers.find(w => w.id === raw);
  if (!worker) {
    res.status(404).json({ error: "Worker not found" });
    return;
  }
  res.json(worker);
});

router.patch("/workers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = workers.findIndex(w => w.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Worker not found" });
    return;
  }
  const { rfidId, name, department, status } = req.body ?? {};
  if (rfidId !== undefined) workers[idx].rfidId = rfidId;
  if (name !== undefined) workers[idx].name = name;
  if (department !== undefined) workers[idx].department = department;
  if (status !== undefined) workers[idx].status = status;
  res.json(workers[idx]);
});

router.delete("/workers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = workers.findIndex(w => w.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Worker not found" });
    return;
  }
  workers.splice(idx, 1);
  res.sendStatus(204);
});

router.get("/workers/:id/compliance", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const worker = workers.find(w => w.id === raw);
  if (!worker) {
    res.status(404).json({ error: "Worker not found" });
    return;
  }
  const workerAlerts = alerts.filter(a => a.workerId === raw);
  res.json({
    workerId: raw,
    totalDays: 30,
    compliantDays: Math.round(worker.complianceRate * 0.3),
    violations: workerAlerts,
  });
});

export default router;
