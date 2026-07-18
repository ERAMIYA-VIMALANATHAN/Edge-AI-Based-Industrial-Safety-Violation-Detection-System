/**
 * YOLO-style PPE Detection Engine
 * Uses TF.js COCO-SSD for person bounding boxes + pixel-based color analysis
 * for helmet and safety-vest classification on each detected person region.
 *
 * Color dataset built from reference images covering:
 *   Helmets: white, yellow, orange, red, blue, green, lime-yellow
 *   Vests:   safety-orange, high-vis yellow, lime-green, reflective strips
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
  gender: "male" | "female";
  personIndex: number;
};

export type WorkerRef = {
  rfidId: string;
  name: string;
  gender?: "male" | "female";
};

/**
 * Frontend gender map — keeps the API schema unchanged.
 * Keys are RFID IDs; values are inferred gender for each registered worker.
 */
export const WORKER_GENDER_MAP: Record<string, "male" | "female"> = {
  "RFID-101": "male",   // James Carter
  "RFID-102": "female", // Maria Santos
  "RFID-103": "male",   // David Kim
  "RFID-104": "female", // Priya Patel
  "RFID-105": "male",   // Omar Hassan
  "RFID-106": "male",   // Chen Wei
  "RFID-107": "female", // Fatima Al-Rashid
  "RFID-108": "male",   // Lucas Oliveira
};

// ─── Color analysis helpers ────────────────────────────────────────────────

/**
 * Helmet color dataset (from reference images):
 *   - White hard hats   : R>190 G>190 B>190
 *   - Yellow hard hats  : R>160 G>140 B<100  (most common construction colour)
 *   - Lime-yellow hats  : R>180 G>200 B<80   (high-vis variant)
 *   - Orange hard hats  : R>180 G>70  B<80
 *   - Red hard hats     : R>150 G<80  B<80
 *   - Blue hard hats    : B > R+30, B>100
 *   - Green hard hats   : G > R+30, G>100
 *
 * Broad bright-saturated signal catches any solid-colour safety helmet
 * that doesn't match the above specific colours.
 */
function analyzeHelmet(data: Uint8ClampedArray): number {
  let hits = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 80) continue;
    total++;

    // ── Specific safety hard-hat colours (strong signal ×2) ──────────────
    const isWhite      = r > 190 && g > 190 && b > 190;
    const isYellow     = r > 160 && g > 140 && b < 100;
    const isLimeYellow = r > 180 && g > 200 && b < 80;
    const isOrange     = r > 180 && g > 70  && g < 160 && b < 80;
    const isRed        = r > 150 && g < 80  && b < 80;
    const isBlue       = b > r + 30 && b > g + 20 && b > 100;
    const isGreen      = g > r + 30 && g > b + 20 && g > 100;

    // ── Broad bright/saturated non-skin signal (weaker ×1) ───────────────
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;
    const isBrightSat = maxC > 130 && saturation > 0.28;
    // Exclude skin tones
    const isSkin = r > 120 && g > 80 && b > 60 && r > g && g > b
                && (r - b) > 30 && saturation < 0.55;

    if (isWhite || isYellow || isLimeYellow || isOrange || isRed || isBlue || isGreen) {
      hits += 2; // strong signal counts double
    } else if (isBrightSat && !isSkin) {
      hits += 1;
    }
  }
  // Normalise against doubled max
  return total > 10 ? Math.min(hits / (total * 2), 1) : 0;
}

/**
 * Vest colour dataset (from reference images):
 *   - Safety orange : R>190 G>80 G<175 B<70   (OIP_(3) orange jacket)
 *   - High-vis yellow: R>185 G>170 B<80       (OIP_(4) left vest)
 *   - Lime/yellow-green: G>175 R>145 B<80     (istockphoto yellow-green vest)
 *   - Neon green    : G>185 R<130 B<90
 *   - Reflective strips: R>200 G>200 B>150    (bright reflective panels)
 */
function analyzeVest(data: Uint8ClampedArray): number {
  let hits = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 80) continue;
    total++;

    const isOrange      = r > 190 && g > 80  && g < 175 && b < 70;
    const isYellow      = r > 185 && g > 170 && b < 80;
    const isYellowGreen = g > 175 && r > 145 && b < 80;
    const isNeon        = g > 185 && r < 130  && b < 90;
    const isReflective  = r > 200 && g > 200 && b > 150;

    if (isOrange || isYellow || isYellowGreen || isNeon || isReflective) hits++;
  }
  return total > 10 ? hits / total : 0;
}

/**
 * Gender estimation based on shoulder-to-head-width ratio.
 *
 * Males typically have broader shoulders relative to their head width
 * (ratio > ~1.4), while females tend to have narrower relative shoulder
 * spread (ratio < ~1.3). This is a heuristic — accuracy improves with
 * clear, unoccluded full-body images.
 */
function estimateGender(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  sw: number, sh: number
): "male" | "female" {
  // Head region: top 20 % of bbox
  const hx  = Math.max(0, Math.round(x));
  const hy  = Math.max(0, Math.round(y));
  const hw  = Math.min(Math.round(w), sw - hx);
  const hh  = Math.min(Math.round(h * 0.20), sh - hy);

  // Shoulder region: 25 – 48 % from top
  const sy  = Math.max(0, Math.round(y + h * 0.25));
  const sh2 = Math.min(Math.round(h * 0.23), sh - sy);

  if (hw <= 0 || hh <= 0 || sh2 <= 0) return "male";

  function horizontalSpread(data: Uint8ClampedArray, width: number, height: number): number {
    let lo = width, hi = 0;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4;
        const a = data[i + 3];
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Only count non-transparent, non-near-black pixels
        if (a > 80 && (r + g + b) > 60) {
          if (col < lo) lo = col;
          if (col > hi) hi = col;
        }
      }
    }
    return hi > lo ? hi - lo : width * 0.5;
  }

  const headData     = ctx.getImageData(hx, hy,  hw, hh).data;
  const shoulderData = ctx.getImageData(hx, sy,  hw, sh2).data;

  const headSpread     = horizontalSpread(headData,     hw, hh);
  const shoulderSpread = horizontalSpread(shoulderData, hw, sh2);

  const ratio = shoulderSpread / Math.max(headSpread, 1);
  // > 1.38 → male (broader shoulders); ≤ 1.38 → female
  return ratio > 1.38 ? "male" : "female";
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
 *
 * Workers are assigned gender-aware round-robin:
 *   - Detected females are matched from the female worker pool first.
 *   - Detected males are matched from the male worker pool first.
 *   - Falls back to the full list if the matching pool is empty.
 */
export async function detectPPE(
  source: HTMLVideoElement | HTMLImageElement,
  workers: WorkerRef[]
): Promise<PersonDetection[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = await getDetectionModel() as any;
  const preds  = await model.detect(source) as Array<{ class: string; score: number; bbox: [number, number, number, number] }>;
  const persons = preds.filter(p => p.class === "person" && p.score > 0.18);
  if (persons.length === 0) return [];

  const snap = snapshotSource(source);

  // Separate worker pools by gender
  const maleWorkers   = workers.filter(w => (w.gender ?? "male") === "male");
  const femaleWorkers = workers.filter(w => w.gender === "female");
  let maleIdx = 0, femaleIdx = 0;

  return persons.map((p, i) => {
    const [x, y, w, h] = p.bbox;

    let hasHelmet = false, helmetConf = 35;
    let hasVest   = false, vestConf   = 35;
    let gender: "male" | "female" = "male";

    if (snap) {
      const { ctx, w: sw, h: sh } = snap;

      // ── Helmet: top 30 % of bbox ─────────────────────────────────────
      const hx = Math.max(0, Math.round(x));
      const hy = Math.max(0, Math.round(y));
      const hw = Math.min(Math.round(w), sw - hx);
      const hh = Math.min(Math.round(h * 0.30), sh - hy);
      if (hw > 0 && hh > 0) {
        const raw = analyzeHelmet(ctx.getImageData(hx, hy, hw, hh).data);
        helmetConf = Math.min(99, Math.round(raw * 400 + 30));
        hasHelmet  = raw > 0.04;
      }

      // ── Vest: torso 20–80 % of bbox height ───────────────────────────
      const tx  = Math.max(0, Math.round(x));
      const ty  = Math.max(0, Math.round(y + h * 0.20));
      const tw2 = Math.min(Math.round(w), sw - tx);
      const th  = Math.min(Math.round(h * 0.60), sh - ty);
      if (tw2 > 0 && th > 0) {
        const raw = analyzeVest(ctx.getImageData(tx, ty, tw2, th).data);
        vestConf = Math.min(99, Math.round(raw * 400 + 30));
        hasVest  = raw > 0.04;
      }

      // ── Gender estimation ─────────────────────────────────────────────
      gender = estimateGender(ctx, x, y, w, h, sw, sh);
    }

    // ── Gender-aware worker assignment ────────────────────────────────────
    let worker: WorkerRef | null = null;
    if (gender === "female" && femaleWorkers.length > 0) {
      worker = femaleWorkers[femaleIdx++ % femaleWorkers.length];
    } else if (gender === "male" && maleWorkers.length > 0) {
      worker = maleWorkers[maleIdx++ % maleWorkers.length];
    } else if (workers.length > 0) {
      worker = workers[i % workers.length];
    }

    return {
      bbox: [x, y, w, h],
      personConfidence: p.score,
      hasHelmet,
      helmetConf,
      hasVest,
      vestConf,
      assignedRfid: worker?.rfidId ?? `RFID-${900 + i}`,
      assignedName: worker?.name  ?? `Worker-${i + 1}`,
      gender,
      personIndex: i,
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
    ctx.moveTo(x + cl, y);         ctx.lineTo(x, y);         ctx.lineTo(x, y + cl);
    ctx.moveTo(x + w - cl, y);     ctx.lineTo(x + w, y);     ctx.lineTo(x + w, y + cl);
    ctx.moveTo(x, y + h - cl);     ctx.lineTo(x, y + h);     ctx.lineTo(x + cl, y + h);
    ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl);
    ctx.stroke();

    // ── Top label: worker name + confidence ─────────────────────────────
    ctx.font = "bold 12px monospace";
    const genderIcon  = det.gender === "female" ? "♀" : "♂";
    const nameLabel   = `${genderIcon} ${det.assignedName}  [${Math.round(det.personConfidence * 100)}%]`;
    const nlw         = ctx.measureText(nameLabel).width + 10;
    ctx.fillStyle     = color;
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
