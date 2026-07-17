import { Router, type IRouter } from "express";
import { getLiveSensorReadings, getSensorHistoryData } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/sensors/live", async (_req, res): Promise<void> => {
  res.json(getLiveSensorReadings());
});

router.get("/sensors/history", async (req, res): Promise<void> => {
  const { sensorId, type } = req.query as Record<string, string | undefined>;
  const history = getSensorHistoryData(sensorId, type);
  res.json(history);
});

export default router;
