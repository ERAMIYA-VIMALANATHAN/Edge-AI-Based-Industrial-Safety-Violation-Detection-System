import { Router, type IRouter } from "express";
import { alerts } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/alerts", async (req, res): Promise<void> => {
  const { status, zoneId, workerId, from, to } = req.query as Record<string, string | undefined>;
  let result = [...alerts];
  if (status) result = result.filter(a => a.status === status);
  if (zoneId) result = result.filter(a => a.zoneId === zoneId);
  if (workerId) result = result.filter(a => a.workerId === workerId);
  if (from) result = result.filter(a => new Date(a.timestamp) >= new Date(from));
  if (to) result = result.filter(a => new Date(a.timestamp) <= new Date(to));
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(result);
});

router.get("/alerts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const alert = alerts.find(a => a.id === raw);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(alert);
});

router.patch("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = alerts.findIndex(a => a.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const { acknowledgedBy } = req.body ?? {};
  alerts[idx].status = "acknowledged";
  alerts[idx].acknowledgedBy = acknowledgedBy ?? "supervisor";
  alerts[idx].acknowledgedAt = new Date().toISOString();
  res.json(alerts[idx]);
});

router.patch("/alerts/:id/resolve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = alerts.findIndex(a => a.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const { resolvedBy } = req.body ?? {};
  alerts[idx].status = "resolved";
  if (!alerts[idx].acknowledgedBy) {
    alerts[idx].acknowledgedBy = resolvedBy ?? "supervisor";
    alerts[idx].acknowledgedAt = new Date().toISOString();
  }
  alerts[idx].resolvedAt = new Date().toISOString();
  res.json(alerts[idx]);
});

export default router;
