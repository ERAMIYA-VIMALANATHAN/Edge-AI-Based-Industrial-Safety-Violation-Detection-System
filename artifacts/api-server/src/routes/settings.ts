import { Router, type IRouter } from "express";
import { settings } from "../lib/mock-data";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  res.json(settings);
});

router.patch("/settings", async (req, res): Promise<void> => {
  const {
    factoryName, factoryLocation, voiceAlertEnabled, voiceLanguage,
    alertRepeatIntervalSeconds, rfidEnabled, sensorThresholds,
    notificationEmail, notificationWebhook,
  } = req.body ?? {};

  if (factoryName !== undefined) settings.factoryName = factoryName;
  if (factoryLocation !== undefined) settings.factoryLocation = factoryLocation;
  if (voiceAlertEnabled !== undefined) settings.voiceAlertEnabled = voiceAlertEnabled;
  if (voiceLanguage !== undefined) settings.voiceLanguage = voiceLanguage;
  if (alertRepeatIntervalSeconds !== undefined) settings.alertRepeatIntervalSeconds = alertRepeatIntervalSeconds;
  if (rfidEnabled !== undefined) settings.rfidEnabled = rfidEnabled;
  if (sensorThresholds !== undefined) settings.sensorThresholds = { ...settings.sensorThresholds, ...sensorThresholds };
  if (notificationEmail !== undefined) settings.notificationEmail = notificationEmail;
  if (notificationWebhook !== undefined) settings.notificationWebhook = notificationWebhook;

  res.json(settings);
});

export default router;
