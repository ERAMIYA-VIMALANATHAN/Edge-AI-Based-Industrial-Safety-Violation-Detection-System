import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import workersRouter from "./workers";
import camerasRouter from "./cameras";
import zonesRouter from "./zones";
import sensorsRouter from "./sensors";
import alertsRouter from "./alerts";
import warningLogsRouter from "./warning-logs";
import reportsRouter from "./reports";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(workersRouter);
router.use(camerasRouter);
router.use(zonesRouter);
router.use(sensorsRouter);
router.use(alertsRouter);
router.use(warningLogsRouter);
router.use(reportsRouter);
router.use(settingsRouter);

export default router;
