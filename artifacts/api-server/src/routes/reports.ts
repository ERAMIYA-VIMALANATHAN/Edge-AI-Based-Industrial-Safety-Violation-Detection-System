import { Router, type IRouter } from "express";
import { alerts, workers, zones } from "../lib/mock-data";

const router: IRouter = Router();

function getDays(period: string): number {
  if (period === "weekly") return 7;
  if (period === "monthly") return 30;
  return 1;
}

router.get("/reports/summary", async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "daily";
  const days = getDays(period);

  const cutoff = new Date(Date.now() - days * 86400_000);
  const periodAlerts = alerts.filter(a => new Date(a.timestamp) >= cutoff);

  const activeWorkers = workers.filter(w => w.status === "active");
  const total = activeWorkers.length || 1;
  const withHelmet = activeWorkers.filter(w => w.ppeStatus.hasHelmet).length;
  const withVest = activeWorkers.filter(w => w.ppeStatus.hasVest).length;
  const withMask = activeWorkers.filter(w => w.ppeStatus.hasMask).length;

  const dailyBreakdown = Array.from({ length: Math.min(days, 7) }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400_000);
    return {
      date: date.toISOString().slice(0, 10),
      violations: Math.floor(Math.random() * 5),
      compliantWorkers: Math.floor(total * 0.75 + Math.random() * total * 0.2),
    };
  });

  res.json({
    period,
    totalViolations: periodAlerts.length,
    totalWorkers: workers.length,
    helmetCompliance: Math.round((withHelmet / total) * 100),
    vestCompliance: Math.round((withVest / total) * 100),
    maskCompliance: Math.round((withMask / total) * 100),
    overallCompliance: Math.round(((withHelmet + withVest + withMask) / (total * 3)) * 100),
    dailyBreakdown,
  });
});

router.get("/reports/zone-violations", async (req, res): Promise<void> => {
  const total = alerts.length || 1;
  const result = zones.map(z => {
    const count = alerts.filter(a => a.zoneId === z.id).length;
    return { zoneId: z.id, zoneName: z.name, violations: count, percentage: Math.round((count / total) * 100) };
  }).sort((a, b) => b.violations - a.violations);
  res.json(result);
});

router.get("/reports/worker-violations", async (_req, res): Promise<void> => {
  const result = workers.map(w => ({
    workerId: w.id,
    workerName: w.name,
    rfidId: w.rfidId,
    violations: w.totalViolations,
    complianceRate: w.complianceRate,
  })).sort((a, b) => b.violations - a.violations);
  res.json(result);
});

router.get("/reports/compliance-trend", async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "weekly";
  const days = getDays(period);

  const result = Array.from({ length: Math.min(days, 14) }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400_000);
    const base = 75 + Math.random() * 20;
    return {
      date: date.toISOString().slice(0, 10),
      helmetCompliance: Math.min(100, Math.round(base + Math.random() * 10)),
      vestCompliance: Math.min(100, Math.round(base + Math.random() * 8)),
      maskCompliance: Math.min(100, Math.round(base - 5 + Math.random() * 15)),
      overallCompliance: Math.min(100, Math.round(base + Math.random() * 5)),
    };
  });
  res.json(result);
});

export default router;
