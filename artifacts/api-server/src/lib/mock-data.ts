// In-memory mock data store for Industrial Safety Monitoring System
// Replace with real DB queries when integrating actual hardware

export type PPEStatus = { hasHelmet: boolean; hasVest: boolean; hasMask: boolean };

export interface Worker {
  id: string;
  rfidId: string;
  name: string;
  department: string;
  currentZone: string | null;
  ppeStatus: PPEStatus;
  lastSeen: string;
  complianceRate: number;
  totalViolations: number;
  status: "active" | "inactive" | "on_leave";
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  status: "online" | "offline" | "maintenance";
  zoneIds: string[];
  ipAddress: string | null;
  resolution: string | null;
  fps: number | null;
}

export interface ZonePolygonPoint { x: number; y: number }

export interface SafetyZone {
  id: string;
  name: string;
  cameraId: string;
  zoneType: "hazard" | "safe" | "restricted";
  polygon: ZonePolygonPoint[];
  requiredPPE: PPEStatus;
  color: string | null;
  description: string | null;
}

export interface SensorReading {
  sensorId: string;
  name: string;
  type: "temperature" | "gas" | "humidity" | "co2";
  value: number;
  unit: string;
  status: "safe" | "warning" | "critical";
  timestamp: string;
  location: string;
  threshold: { warning: number; critical: number };
}

export interface Alert {
  id: string;
  workerId: string;
  rfidId: string;
  workerName: string;
  cameraId: string;
  zoneId: string;
  zoneName: string;
  missingPPE: string[];
  status: "active" | "acknowledged" | "resolved";
  timestamp: string;
  snapshotUrl: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  voiceAlertText: string | null;
}

export interface WarningLog {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  zoneId: string;
  zoneName: string;
  trackId: string;
  rfidId: string;
  workerName: string | null;
  missingPPE: string[];
  alertStatus: "active" | "acknowledged" | "resolved";
  snapshotUrl: string | null;
}

export interface SystemSettings {
  id: string;
  factoryName: string;
  factoryLocation: string | null;
  voiceAlertEnabled: boolean;
  voiceLanguage: string;
  alertRepeatIntervalSeconds: number;
  rfidEnabled: boolean;
  sensorThresholds: {
    temperature: { warning: number; critical: number };
    gas: { warning: number; critical: number };
    humidity: { warning: number; critical: number };
  };
  notificationEmail: string | null;
  notificationWebhook: string | null;
}

function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// ── Workers ────────────────────────────────────────────────────────────────
export const workers: Worker[] = [
  { id: "w1", rfidId: "RFID-101", name: "James Carter", department: "Welding", currentZone: "Welding Zone A", ppeStatus: { hasHelmet: true, hasVest: true, hasMask: false }, lastSeen: isoAgo(2), complianceRate: 82, totalViolations: 7, status: "active" },
  { id: "w2", rfidId: "RFID-102", name: "Maria Santos", department: "Assembly", currentZone: "Assembly Bay", ppeStatus: { hasHelmet: true, hasVest: true, hasMask: true }, lastSeen: isoAgo(1), complianceRate: 97, totalViolations: 1, status: "active" },
  { id: "w3", rfidId: "RFID-103", name: "David Kim", department: "Chemical", currentZone: "Chemical Storage", ppeStatus: { hasHelmet: false, hasVest: true, hasMask: true }, lastSeen: isoAgo(5), complianceRate: 75, totalViolations: 12, status: "active" },
  { id: "w4", rfidId: "RFID-104", name: "Priya Patel", department: "Welding", currentZone: null, ppeStatus: { hasHelmet: true, hasVest: true, hasMask: true }, lastSeen: isoAgo(60), complianceRate: 100, totalViolations: 0, status: "active" },
  { id: "w5", rfidId: "RFID-105", name: "Omar Hassan", department: "Maintenance", currentZone: "Maintenance Area", ppeStatus: { hasHelmet: true, hasVest: false, hasMask: false }, lastSeen: isoAgo(3), complianceRate: 68, totalViolations: 18, status: "active" },
  { id: "w6", rfidId: "RFID-106", name: "Chen Wei", department: "Assembly", currentZone: "Assembly Bay", ppeStatus: { hasHelmet: true, hasVest: true, hasMask: true }, lastSeen: isoAgo(1), complianceRate: 95, totalViolations: 2, status: "active" },
  { id: "w7", rfidId: "RFID-107", name: "Fatima Al-Rashid", department: "Chemical", currentZone: null, ppeStatus: { hasHelmet: true, hasVest: true, hasMask: true }, lastSeen: isoAgo(120), complianceRate: 91, totalViolations: 3, status: "on_leave" },
  { id: "w8", rfidId: "RFID-108", name: "Lucas Oliveira", department: "Maintenance", currentZone: null, ppeStatus: { hasHelmet: true, hasVest: true, hasMask: true }, lastSeen: isoAgo(240), complianceRate: 89, totalViolations: 4, status: "inactive" },
];

// ── Cameras ────────────────────────────────────────────────────────────────
export const cameras: Camera[] = [
  { id: "cam1", name: "Cam-01 Welding Bay", location: "Building A - Floor 1", streamUrl: "rtsp://mock-stream/cam1", status: "online", zoneIds: ["z1", "z2"], ipAddress: "192.168.1.101", resolution: "1920x1080", fps: 30 },
  { id: "cam2", name: "Cam-02 Assembly Line", location: "Building B - Floor 1", streamUrl: "rtsp://mock-stream/cam2", status: "online", zoneIds: ["z3"], ipAddress: "192.168.1.102", resolution: "1920x1080", fps: 25 },
  { id: "cam3", name: "Cam-03 Chemical Storage", location: "Building C - Ground", streamUrl: "rtsp://mock-stream/cam3", status: "online", zoneIds: ["z4"], ipAddress: "192.168.1.103", resolution: "1280x720", fps: 20 },
  { id: "cam4", name: "Cam-04 Maintenance", location: "Building A - Floor 2", streamUrl: "rtsp://mock-stream/cam4", status: "offline", zoneIds: [], ipAddress: "192.168.1.104", resolution: "1920x1080", fps: 30 },
];

// ── Safety Zones ────────────────────────────────────────────────────────────
export const zones: SafetyZone[] = [
  { id: "z1", name: "Welding Zone A", cameraId: "cam1", zoneType: "hazard", polygon: [{x:50,y:50},{x:250,y:50},{x:250,y:200},{x:50,y:200}], requiredPPE: { hasHelmet: true, hasVest: true, hasMask: true }, color: "#ef4444", description: "High heat welding operations" },
  { id: "z2", name: "Welding Zone B", cameraId: "cam1", zoneType: "hazard", polygon: [{x:300,y:80},{x:500,y:80},{x:500,y:250},{x:300,y:250}], requiredPPE: { hasHelmet: true, hasVest: true, hasMask: false }, color: "#f97316", description: "Secondary welding station" },
  { id: "z3", name: "Assembly Bay", cameraId: "cam2", zoneType: "safe", polygon: [{x:100,y:100},{x:600,y:100},{x:600,y:400},{x:100,y:400}], requiredPPE: { hasHelmet: true, hasVest: true, hasMask: false }, color: "#22c55e", description: "Assembly and production line" },
  { id: "z4", name: "Chemical Storage", cameraId: "cam3", zoneType: "restricted", polygon: [{x:80,y:60},{x:350,y:60},{x:350,y:300},{x:80,y:300}], requiredPPE: { hasHelmet: true, hasVest: true, hasMask: true }, color: "#a855f7", description: "Hazardous chemical storage - full PPE required" },
];

// ── Sensors ─────────────────────────────────────────────────────────────────
const baseSensorValues = {
  temp1: 42.3, temp2: 38.7,
  gas1: 18.5, gas2: 31.2,
  hum1: 55.0, co2_1: 412,
};

export function getLiveSensorReadings(): SensorReading[] {
  const jitter = (v: number, range: number) => parseFloat((v + (Math.random() - 0.5) * range).toFixed(1));
  return [
    { sensorId: "s1", name: "Welding Bay Temp", type: "temperature", value: jitter(baseSensorValues.temp1, 3), unit: "°C", status: "warning", timestamp: new Date().toISOString(), location: "Building A - Welding", threshold: { warning: 40, critical: 60 } },
    { sensorId: "s2", name: "Assembly Hall Temp", type: "temperature", value: jitter(baseSensorValues.temp2, 2), unit: "°C", status: "safe", timestamp: new Date().toISOString(), location: "Building B - Assembly", threshold: { warning: 40, critical: 60 } },
    { sensorId: "s3", name: "Gas Detector A", type: "gas", value: jitter(baseSensorValues.gas1, 2), unit: "ppm", status: "safe", timestamp: new Date().toISOString(), location: "Building A - Floor 1", threshold: { warning: 25, critical: 50 } },
    { sensorId: "s4", name: "Chemical Area Gas", type: "gas", value: jitter(baseSensorValues.gas2, 4), unit: "ppm", status: "warning", timestamp: new Date().toISOString(), location: "Building C - Chemical", threshold: { warning: 25, critical: 50 } },
    { sensorId: "s5", name: "Humidity Sensor 1", type: "humidity", value: jitter(baseSensorValues.hum1, 5), unit: "%", status: "safe", timestamp: new Date().toISOString(), location: "Building B - Assembly", threshold: { warning: 70, critical: 85 } },
    { sensorId: "s6", name: "CO2 Monitor", type: "co2", value: jitter(baseSensorValues.co2_1, 20), unit: "ppm", status: "safe", timestamp: new Date().toISOString(), location: "Building A - Floor 1", threshold: { warning: 1000, critical: 2000 } },
  ];
}

// Generate 48 hours of sensor history
export function getSensorHistoryData(sensorId?: string, type?: string): Array<{ sensorId: string; timestamp: string; value: number }> {
  const results: Array<{ sensorId: string; timestamp: string; value: number }> = [];
  const sensors = [
    { id: "s1", base: 42, range: 8 }, { id: "s2", base: 38, range: 5 },
    { id: "s3", base: 18, range: 6 }, { id: "s4", base: 30, range: 10 },
    { id: "s5", base: 55, range: 12 }, { id: "s6", base: 410, range: 40 },
  ];
  const filtered = sensorId ? sensors.filter(s => s.id === sensorId) : sensors;
  for (const s of filtered) {
    for (let i = 48; i >= 0; i--) {
      results.push({
        sensorId: s.id,
        timestamp: new Date(Date.now() - i * 3600_000).toISOString(),
        value: parseFloat((s.base + (Math.random() - 0.5) * s.range).toFixed(1)),
      });
    }
  }
  return results;
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export const alerts: Alert[] = [
  { id: "a1", workerId: "w1", rfidId: "RFID-101", workerName: "James Carter", cameraId: "cam1", zoneId: "z1", zoneName: "Welding Zone A", missingPPE: ["Face Mask"], status: "active", timestamp: isoAgo(3), snapshotUrl: null, acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, voiceAlertText: "Attention Employee RFID 101. You have entered Welding Zone A without wearing a face mask. Please wear your face mask immediately." },
  { id: "a2", workerId: "w3", rfidId: "RFID-103", workerName: "David Kim", cameraId: "cam3", zoneId: "z4", zoneName: "Chemical Storage", missingPPE: ["Safety Helmet"], status: "active", timestamp: isoAgo(5), snapshotUrl: null, acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, voiceAlertText: "Attention Employee RFID 103. You have entered Chemical Storage without wearing a safety helmet. Please wear your safety helmet immediately." },
  { id: "a3", workerId: "w5", rfidId: "RFID-105", workerName: "Omar Hassan", cameraId: "cam2", zoneId: "z3", zoneName: "Assembly Bay", missingPPE: ["Safety Vest", "Face Mask"], status: "acknowledged", timestamp: isoAgo(30), snapshotUrl: null, acknowledgedBy: "supervisor1", acknowledgedAt: isoAgo(25), resolvedAt: null, voiceAlertText: "Attention Employee RFID 105. Safety vest and face mask are missing. Please wear your PPE before continuing work." },
  { id: "a4", workerId: "w1", rfidId: "RFID-101", workerName: "James Carter", cameraId: "cam1", zoneId: "z1", zoneName: "Welding Zone A", missingPPE: ["Face Mask"], status: "resolved", timestamp: isoAgo(120), snapshotUrl: null, acknowledgedBy: "supervisor1", acknowledgedAt: isoAgo(115), resolvedAt: isoAgo(110), voiceAlertText: "Attention Employee RFID 101. Face mask missing in Welding Zone A." },
  { id: "a5", workerId: "w5", rfidId: "RFID-105", workerName: "Omar Hassan", cameraId: "cam1", zoneId: "z2", zoneName: "Welding Zone B", missingPPE: ["Safety Vest"], status: "resolved", timestamp: isoAgo(180), snapshotUrl: null, acknowledgedBy: "supervisor2", acknowledgedAt: isoAgo(175), resolvedAt: isoAgo(160), voiceAlertText: "Attention Employee RFID 105. Safety vest is missing. Please wear your safety vest before continuing work." },
];

// ── Warning Logs ────────────────────────────────────────────────────────────
export const warningLogs: WarningLog[] = alerts.map((a, i) => ({
  id: `wl${i + 1}`,
  timestamp: a.timestamp,
  cameraId: a.cameraId,
  cameraName: cameras.find(c => c.id === a.cameraId)?.name ?? a.cameraId,
  zoneId: a.zoneId,
  zoneName: a.zoneName,
  trackId: `TRK-${String(i + 1).padStart(3, "0")}`,
  rfidId: a.rfidId,
  workerName: a.workerName,
  missingPPE: a.missingPPE,
  alertStatus: a.status,
  snapshotUrl: null,
}));

// ── Settings ─────────────────────────────────────────────────────────────────
export const settings: SystemSettings = {
  id: "default",
  factoryName: "MetalWorks Industrial Plant",
  factoryLocation: "Houston, TX, USA",
  voiceAlertEnabled: true,
  voiceLanguage: "en-US",
  alertRepeatIntervalSeconds: 30,
  rfidEnabled: true,
  sensorThresholds: {
    temperature: { warning: 40, critical: 60 },
    gas: { warning: 25, critical: 50 },
    humidity: { warning: 70, critical: 85 },
  },
  notificationEmail: "safety@metalworks.com",
  notificationWebhook: null,
};

// ── Live Feed (mock YOLO/ByteTrack detections) ──────────────────────────────
export function generateLiveFeed() {
  const randomBool = (bias = 0.8) => Math.random() < bias;
  return [
    {
      cameraId: "cam1",
      cameraName: "Cam-01 Welding Bay",
      location: "Building A - Floor 1",
      status: "online" as const,
      frameWidth: 1920,
      frameHeight: 1080,
      detections: [
        { trackId: "TRK-001", rfidId: "RFID-101", workerName: "James Carter", x: 120, y: 200, width: 80, height: 180, hasHelmet: randomBool(), hasVest: randomBool(), hasMask: Math.random() < 0.3, inHazardZone: true, zoneName: "Welding Zone A", confidence: 0.94 },
        { trackId: "TRK-004", rfidId: null, workerName: null, x: 380, y: 180, width: 75, height: 175, hasHelmet: randomBool(), hasVest: randomBool(0.9), hasMask: randomBool(0.7), inHazardZone: true, zoneName: "Welding Zone B", confidence: 0.87 },
      ],
    },
    {
      cameraId: "cam2",
      cameraName: "Cam-02 Assembly Line",
      location: "Building B - Floor 1",
      status: "online" as const,
      frameWidth: 1920,
      frameHeight: 1080,
      detections: [
        { trackId: "TRK-002", rfidId: "RFID-102", workerName: "Maria Santos", x: 250, y: 300, width: 70, height: 165, hasHelmet: true, hasVest: true, hasMask: true, inHazardZone: false, zoneName: "Assembly Bay", confidence: 0.96 },
        { trackId: "TRK-006", rfidId: "RFID-106", workerName: "Chen Wei", x: 500, y: 280, width: 72, height: 168, hasHelmet: true, hasVest: true, hasMask: randomBool(), inHazardZone: false, zoneName: "Assembly Bay", confidence: 0.91 },
        { trackId: "TRK-005", rfidId: "RFID-105", workerName: "Omar Hassan", x: 150, y: 350, width: 78, height: 172, hasHelmet: true, hasVest: Math.random() < 0.4, hasMask: false, inHazardZone: false, zoneName: "Assembly Bay", confidence: 0.89 },
      ],
    },
    {
      cameraId: "cam3",
      cameraName: "Cam-03 Chemical Storage",
      location: "Building C - Ground",
      status: "online" as const,
      frameWidth: 1280,
      frameHeight: 720,
      detections: [
        { trackId: "TRK-003", rfidId: "RFID-103", workerName: "David Kim", x: 200, y: 150, width: 68, height: 160, hasHelmet: Math.random() < 0.5, hasVest: true, hasMask: true, inHazardZone: true, zoneName: "Chemical Storage", confidence: 0.92 },
      ],
    },
    {
      cameraId: "cam4",
      cameraName: "Cam-04 Maintenance",
      location: "Building A - Floor 2",
      status: "offline" as const,
      frameWidth: 1920,
      frameHeight: 1080,
      detections: [],
    },
  ];
}
