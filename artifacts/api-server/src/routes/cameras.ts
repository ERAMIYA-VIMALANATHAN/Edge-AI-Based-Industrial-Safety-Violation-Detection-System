import { Router, type IRouter } from "express";
import { cameras, type Camera } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/cameras", async (_req, res): Promise<void> => {
  res.json(cameras);
});

router.post("/cameras", async (req, res): Promise<void> => {
  const { name, location, streamUrl, ipAddress, resolution, fps, zoneIds } = req.body ?? {};
  if (!name || !location || !streamUrl) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const camera: Camera = {
    id: `cam${Date.now()}`,
    name,
    location,
    streamUrl,
    status: "online",
    zoneIds: zoneIds ?? [],
    ipAddress: ipAddress ?? null,
    resolution: resolution ?? null,
    fps: fps ?? null,
  };
  cameras.push(camera);
  res.status(201).json(camera);
});

router.get("/cameras/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const camera = cameras.find(c => c.id === raw);
  if (!camera) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }
  res.json(camera);
});

router.patch("/cameras/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = cameras.findIndex(c => c.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }
  const { name, location, streamUrl, status, ipAddress, resolution, fps, zoneIds } = req.body ?? {};
  if (name !== undefined) cameras[idx].name = name;
  if (location !== undefined) cameras[idx].location = location;
  if (streamUrl !== undefined) cameras[idx].streamUrl = streamUrl;
  if (status !== undefined) cameras[idx].status = status;
  if (ipAddress !== undefined) cameras[idx].ipAddress = ipAddress;
  if (resolution !== undefined) cameras[idx].resolution = resolution;
  if (fps !== undefined) cameras[idx].fps = fps;
  if (zoneIds !== undefined) cameras[idx].zoneIds = zoneIds;
  res.json(cameras[idx]);
});

router.delete("/cameras/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = cameras.findIndex(c => c.id === raw);
  if (idx === -1) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }
  cameras.splice(idx, 1);
  res.sendStatus(204);
});

export default router;
