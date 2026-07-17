import { Router, type IRouter } from "express";
import { zones, type SafetyZone } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/zones", async (_req, res): Promise<void> => {
  res.json(zones);
});

router.post("/zones", async (req, res): Promise<void> => {
  const { name, cameraId, zoneType, polygon, requiredPPE, color, description } = req.body ?? {};
  if (!name || !cameraId || !zoneType || !polygon || !requiredPPE) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const zone: SafetyZone = {
    id: `z${Date.now()}`,
    name,
    cameraId,
    zoneType,
    polygon,
    requiredPPE,
    color: color ?? null,
    description: description ?? null,
  };
  zones.push(zone);
  res.status(201).json(zone);
});

router.get("/zones/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const zone = zones.find(z => z.id === raw);
  if (!zone) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }
  res.json(zone);
});

router.patch("/zones/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = zones.findIndex(z => z.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }
  const { name, zoneType, polygon, requiredPPE, color, description } = req.body ?? {};
  if (name !== undefined) zones[idx].name = name;
  if (zoneType !== undefined) zones[idx].zoneType = zoneType;
  if (polygon !== undefined) zones[idx].polygon = polygon;
  if (requiredPPE !== undefined) zones[idx].requiredPPE = requiredPPE;
  if (color !== undefined) zones[idx].color = color;
  if (description !== undefined) zones[idx].description = description;
  res.json(zones[idx]);
});

router.delete("/zones/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = zones.findIndex(z => z.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }
  zones.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
