import { Router, type IRouter } from "express";
import { warningLogs } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/warning-logs", async (req, res): Promise<void> => {
  const { cameraId, zoneId, from, to } = req.query as Record<string, string | undefined>;
  let result = [...warningLogs];
  if (cameraId) result = result.filter(w => w.cameraId === cameraId);
  if (zoneId) result = result.filter(w => w.zoneId === zoneId);
  if (from) result = result.filter(w => new Date(w.timestamp) >= new Date(from));
  if (to) result = result.filter(w => new Date(w.timestamp) <= new Date(to));
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(result);
});

export default router;
