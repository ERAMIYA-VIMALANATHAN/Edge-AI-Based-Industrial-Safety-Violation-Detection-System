/**
 * YOLO-style PPE Detection Engine
 * Uses TF.js COCO-SSD for person bounding boxes + pixel-based color analysis
 * for helmet and safety-vest classification on each detected person region.
 */
import { getDetectionModel } from "./detection-model";

export type PersonDetection = {
  bbox: [number, number, number, number]; // [x, y, w, h] in source pixel space
  personConfidence: number;               // 0–1 COCO-SSD score
  hasHelmet: boolean;
  helmetConf: number;                     // 0–99 percentage
  hasVest: boolean;
  vestConf: number;                       // 0–99 percentage
  assignedRfid: string;
  assignedName: string;
  personIndex: number;
};

export type WorkerRef = { rfidId: string; name: string };

// ─── Color analysis helpers ────────────────────────────────────────────────

/** Hard-hat colours: yellow, white, orange, blue, red, green lids */
function analyzeHelmet(data: Uint8ClampedArray): number {
  let hits = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 100) continue;
    total++;
    const isYellow  = r > 175 && g > 150 && b < 90;
    const isWhite   = r > 205 && g > 205 && b > 205;
    const isOrange  = r > 195 && g > 85  && g < 165 && b < 70;
    const isBlue    = b > r + 40 && b > g + 30 && b > 120;
    const isRed     = r > 165 && g < 90  && b < 90;
    const isGreen   = g > r + 40 && g > b + 30 && g > 120;
    if (isYellow || isWhite || isOrange || isBlue || isRed || isGreen) hits++;
  }
  return total > 10 ? hits / total : 0;
}

/** Safety-vest colours: safety orange, high-vis yellow/lime, neon green */
function analyzeVest(data: Uint8ClampedArray): number {
  let hits = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 100) continue;
    total++;
    const isOrange      = r > 210 && g > 90  && g < 170 && b < 60;
    const isYellow      = r > 200 && g > 185 && b < 70;
    const isYellowGreen = g > 190 && r > 160 && b < 70;
    const isNeon        = g > 200 && r < 120  && b < 80;
    if (isOrange || isYellow || isYellowGreen || isNeon) hits++;
  }
  return total > 10 ? hits / total : 0;
}

/** Draw source into an offscreen canvas and return its 2D context. */
function snapshotSource(source: HTMLVideoElement | HTMLImageElement): {
  ctx: CanvasRenderingContext2D; w: number; h: number;
} | null {
  const w = source instanceof HTMLVideoElement ? source.videoWidth  : (source as HTMLImageElement).naturalWidth;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLImageElement).naturalHeight;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return { ctx, w, h };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Detect persons in a video frame or image and classify their PPE.
 * Workers are assigned round-robin by detection order.
 */
export async function detectPPE(
  source: HTMLVideoElement | HTMLImageElement,
  workers: WorkerRef[]
): Promise<PersonDetection[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = await getDetectionModel() as any;
  const preds  = await model.detect(source) as Array<{ class: string; score: number; bbox: [number, number, number, number] }>;
  const persons = preds.filter(p => p.class === "person" && p.score > 0.38);
  if (persons.length === 0) return [];

  const snap = snapshotSource(source);

  return persons.map((p, i) => {
    const [x, y, w, h] = p.bbox;

    let hasHelmet = false, helmetConf = 35;
    let hasVest   = false, vestConf   = 35;

    if (snap) {
      const { ctx, w: sw, h: sh } = snap;

      // Head region = top 30 % of bbox
      const hx = Math.max(0, Math.round(x));
      const hy = Math.max(0, Math.round(y));
      const hw = Math.min(Math.round(w), sw - hx);
      const hh = Math.min(Math.round(h * 0.30), sh - hy);
      if (hw > 0 && hh > 0) {
        const raw = analyzeHelmet(ctx.getImageData(hx, hy, hw, hh).data);
        helmetConf = Math.min(99, Math.round(raw * 500 + 35));
        hasHelmet  = raw > 0.07;
      }

      // Torso region = 25–75 % of bbox height
      const tx = Math.max(0, Math.round(x));
      const ty = Math.max(0, Math.round(y + h * 0.25));
      const tw2 = Math.min(Math.round(w), sw - tx);
      const th = Math.min(Math.round(h * 0.50), sh - ty);
      if (tw2 > 0 && th > 0) {
        const raw = analyzeVest(ctx.getImageData(tx, ty, tw2, th).data);
        vestConf = Math.min(99, Math.round(raw * 500 + 35));
        hasVest  = raw > 0.07;
      }
    }

    const worker = workers.length > 0 ? workers[i % workers.length] : null;

    return {
      bbox: [x, y, w, h],
      personConfidence: p.score,
      hasHelmet,
      helmetConf,
      hasVest,
      vestConf,
      assignedRfid: worker?.rfidId ?? `RFID-${900 + i}`,
      assignedName: worker?.name  ?? `Worker-${i + 1}`,
      personIndex:  i,
    };
  });
}

// ─── Canvas drawing ────────────────────────────────────────────────────────

/** Draw YOLO-style bounding boxes + PPE badges onto a canvas context. */
export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: PersonDetection[],
  cw: number,
  ch: number
) {
  ctx.clearRect(0, 0, cw, ch);

  detections.forEach(det => {
    const [x, y, w, h] = det.bbox;
    const violation = !det.hasHelmet || !det.hasVest;
    const color     = violation ? "#ef4444" : "#22c55e";
    const cl        = 14; // corner-accent length

    // Dim fill for body area
    ctx.fillStyle = violation ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.05)";
    ctx.fillRect(x, y, w, h);

    // Main box
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    // Corner accents (YOLO style)
    ctx.lineWidth   = 3;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + cl, y);      ctx.lineTo(x, y);      ctx.lineTo(x, y + cl);
    ctx.moveTo(x + w - cl, y);  ctx.lineTo(x + w, y);  ctx.lineTo(x + w, y + cl);
    ctx.moveTo(x, y + h - cl);  ctx.lineTo(x, y + h);  ctx.lineTo(x + cl, y + h);
    ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
    ctx.stroke();

    // ── Top label bar: worker name + person confidence ──────────────────
    ctx.font = "bold 12px monospace";
    const nameLabel = `${det.assignedName}  [${Math.round(det.personConfidence * 100)}%]`;
    const nlw       = ctx.measureText(nameLabel).width + 10;
    ctx.fillStyle   = color;
    ctx.fillRect(x - 1, y - 24, nlw, 24);
    ctx.fillStyle = "#000";
    ctx.fillText(nameLabel, x + 4, y - 7);

    // ── RFID badge (top-left inside box) ─────────────────────────────────
    ctx.font      = "10px monospace";
    const rfLabel = det.assignedRfid;
    const rlw     = ctx.measureText(rfLabel).width + 8;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(x + 1, y + 1, rlw, 17);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(rfLabel, x + 5, y + 13);

    // ── Bottom PPE badges ─────────────────────────────────────────────────
    ctx.font = "bold 10px monospace";
    const hLabel = `H:${det.hasHelmet ? "✓" : "✗"} ${det.helmetConf}%`;
    const vLabel = `V:${det.hasVest   ? "✓" : "✗"} ${det.vestConf}%`;
    const hlw    = ctx.measureText(hLabel).width + 8;
    const vlw    = ctx.measureText(vLabel).width + 8;

    ctx.fillStyle = det.hasHelmet ? "#22c55e" : "#ef4444";
    ctx.fillRect(x, y + h + 2, hlw, 18);
    ctx.fillStyle = "#000";
    ctx.fillText(hLabel, x + 4, y + h + 14);

    ctx.fillStyle = det.hasVest ? "#22c55e" : "#ef4444";
    ctx.fillRect(x + hlw + 2, y + h + 2, vlw, 18);
    ctx.fillStyle = "#000";
    ctx.fillText(vLabel, x + hlw + 6, y + h + 14);
  });
}
