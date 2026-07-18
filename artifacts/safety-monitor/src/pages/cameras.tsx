import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  useListCameras,
  useCreateCamera,
  useUpdateCamera,
  useDeleteCamera,
  useListWorkers,
  useGetLiveSensorData,
  Camera as CameraType,
} from "@workspace/api-client-react";
import {
  Camera, Settings2, Trash2, Plus, Edit2, Upload, VideoOff, Film, Image as ImageIcon,
  Loader2, Users, Maximize2, HardHat, ShieldCheck, Thermometer, Wind, BarChart3,
  ChevronRight, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListCamerasQueryKey } from "@workspace/api-client-react";
import { useCameraMedia } from "../context/camera-video-context";
import { useLocalWarningLogs } from "../context/local-warning-logs-context";
import { useNotifications } from "../context/notification-context";
import {
  detectPPE, drawDetections, type PersonDetection, WORKER_GENDER_MAP,
} from "../lib/ppe-detection";
import { getDetectionModel } from "../lib/detection-model";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const cameraSchema = z.object({
  name:       z.string().min(1, "Name is required"),
  location:   z.string().min(1, "Location is required"),
  streamUrl:  z.string().url("Valid URL required"),
  ipAddress:  z.string().optional(),
  resolution: z.string().optional(),
  fps:        z.coerce.number().optional(),
});
type CameraFormData = z.infer<typeof cameraSchema>;

// ── Sensor → camera mapping ────────────────────────────────────────────────
const CAM_SENSOR_MAP: Record<string, { tempId: string; gasId: string }> = {
  cam1: { tempId: "s1", gasId: "s3" },
  cam2: { tempId: "s2", gasId: "s3" },
  cam3: { tempId: "s2", gasId: "s4" },
  cam4: { tempId: "s1", gasId: "s3" },
};

// ── Deterministic risk history per camera ─────────────────────────────────
function seedRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = ((s * 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function buildRiskHistory(camId: string, detections: PersonDetection[]) {
  const rand = seedRand(camId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

  // Anchor Today to actual detection result
  const todayHelmet = detections.length > 0
    ? Math.round((detections.filter(d => d.hasHelmet).length / detections.length) * 100)
    : 80;
  const todayVest = detections.length > 0
    ? Math.round((detections.filter(d => d.hasVest).length / detections.length) * 100)
    : 78;

  return days.map((day, i) => {
    if (i === 6) return { day, helmet: todayHelmet, vest: todayVest, risk: Math.round((200 - todayHelmet - todayVest) / 2) };
    const h = Math.min(100, Math.max(50, 60 + Math.round(rand() * 40)));
    const v = Math.min(100, Math.max(50, 60 + Math.round(rand() * 40)));
    return { day, helmet: h, vest: v, risk: Math.round((200 - h - v) / 2) };
  });
}

// ─── Photo detection card ──────────────────────────────────────────────────

function PhotoDetectionCard({
  cam,
  photoUrl,
  detections,
  onRemove,
  compact = false,
}: {
  cam: CameraType;
  photoUrl: string;
  detections: PersonDetection[];
  onRemove: () => void;
  compact?: boolean;
}) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paintBoxes = useCallback(() => {
    const img    = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth || !img.clientWidth) return;

    const scaleX = img.clientWidth  / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    canvas.width  = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaled = detections.map(d => ({
      ...d,
      bbox: [
        d.bbox[0] * scaleX,
        d.bbox[1] * scaleY,
        d.bbox[2] * scaleX,
        d.bbox[3] * scaleY,
      ] as [number, number, number, number],
    }));
    drawDetections(ctx, scaled, canvas.width, canvas.height);
  }, [detections]);

  useEffect(() => {
    if (imgRef.current?.complete) paintBoxes();
  }, [paintBoxes]);

  const violations = detections.filter(d => !d.hasHelmet || !d.hasVest);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ImageIcon size={12} className="text-slate-400" />
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            {compact ? "Photo Analysis" : `Photo Analysis — ${cam.name}`} · {detections.length} Person{detections.length !== 1 ? "s" : ""} Detected
          </span>
        </div>
        <div className="flex items-center gap-3">
          {violations.length > 0 && (
            <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
              {violations.length} Violation{violations.length > 1 ? "s" : ""}
            </span>
          )}
          <button onClick={onRemove} className="text-[10px] text-slate-600 hover:text-red-400 font-mono uppercase transition-colors">Remove</button>
        </div>
      </div>
      <div className="relative bg-slate-950">
        <img
          ref={imgRef}
          src={photoUrl}
          alt="PPE analysis"
          onLoad={paintBoxes}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
      </div>
      {!compact && detections.length > 0 && (
        <div className="p-3 border-t border-slate-800 grid grid-cols-2 gap-2">
          {detections.map((d, i) => (
            <div key={i} className="text-[10px] font-mono bg-slate-900 rounded p-2 border border-slate-800">
              <div className="font-bold text-white mb-1">
                {d.gender === "female" ? "♀" : "♂"} {d.assignedName}
              </div>
              <div className="text-slate-500 mb-1">{d.assignedRfid}</div>
              <div className="flex gap-1 flex-wrap">
                <span className={`px-1 rounded ${d.hasHelmet ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  H:{d.hasHelmet ? "✓" : "✗"} {d.helmetConf}%
                </span>
                <span className={`px-1 rounded ${d.hasVest ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  V:{d.hasVest ? "✓" : "✗"} {d.vestConf}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Camera detail modal ───────────────────────────────────────────────────

function CameraDetailModal({
  cam,
  detections,
  photoUrl,
  onClose,
  onRemovePhoto,
}: {
  cam: CameraType;
  detections: PersonDetection[];
  photoUrl?: string;
  onClose: () => void;
  onRemovePhoto: () => void;
}) {
  const { data: sensors = [] } = useGetLiveSensorData();

  const sensorMap = CAM_SENSOR_MAP[cam.id] ?? { tempId: "s1", gasId: "s3" };
  const tempSensor = sensors.find(s => s.sensorId === sensorMap.tempId);
  const gasSensor  = sensors.find(s => s.sensorId === sensorMap.gasId);

  const helmetViolations = detections.filter(d => !d.hasHelmet);
  const vestViolations   = detections.filter(d => !d.hasVest);

  const riskData = useMemo(() => buildRiskHistory(cam.id, detections), [cam.id, detections]);

  const tempStatus = tempSensor?.status ?? "safe";
  const gasStatus  = gasSensor?.status  ?? "safe";
  const statusColor = (s: string) =>
    s === "critical" ? "text-red-400" : s === "warning" ? "text-amber-400" : "text-green-400";
  const statusBg = (s: string) =>
    s === "critical" ? "border-red-500/40 bg-red-500/10" : s === "warning" ? "border-amber-500/40 bg-amber-500/10" : "border-green-500/30 bg-green-500/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Camera size={16} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono uppercase tracking-tight">{cam.name}</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{cam.location} · Detailed Analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Top row: image + stats ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Image with bounding boxes */}
            <div className="lg:col-span-3">
              {photoUrl ? (
                <PhotoDetectionCard
                  cam={cam}
                  photoUrl={photoUrl}
                  detections={detections}
                  onRemove={onRemovePhoto}
                  compact
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-950 border border-slate-800 rounded-lg text-slate-600">
                  <ImageIcon size={32} className="mb-2 opacity-40" />
                  <span className="text-xs font-mono uppercase">No image uploaded for this camera</span>
                </div>
              )}
            </div>

            {/* Right stats column */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Persons detected */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Persons Detected</div>
                <div className="text-4xl font-bold text-white font-mono">{detections.length}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  {detections.filter(d => d.hasHelmet && d.hasVest).length} fully compliant
                </div>
              </div>

              {/* Safety wear breakdown */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-3">Safety Wear</div>
                <div className="space-y-3">
                  {/* Helmet column */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardHat size={14} className="text-amber-400" />
                      <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">Helmet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {helmetViolations.length > 0 ? (
                        <span className="text-xs font-bold font-mono text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">
                          {helmetViolations.length} Missing
                        </span>
                      ) : (
                        <span className="text-xs font-bold font-mono text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded">
                          All OK
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Vest column */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-blue-400" />
                      <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">Safety Vest</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {vestViolations.length > 0 ? (
                        <span className="text-xs font-bold font-mono text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">
                          {vestViolations.length} Missing
                        </span>
                      ) : (
                        <span className="text-xs font-bold font-mono text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded">
                          All OK
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sensor readings */}
              <div className="grid grid-cols-2 gap-3">
                {/* Temperature */}
                <div className={`rounded-lg border p-3 ${statusBg(tempStatus)}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Thermometer size={13} className={statusColor(tempStatus)} />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Temperature</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${statusColor(tempStatus)}`}>
                    {tempSensor ? `${tempSensor.value}${tempSensor.unit}` : "—"}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                    {tempSensor?.name ?? "Sensor N/A"}
                  </div>
                  <div className={`text-[9px] font-bold font-mono uppercase mt-0.5 ${statusColor(tempStatus)}`}>
                    {tempStatus}
                  </div>
                </div>

                {/* Gas level */}
                <div className={`rounded-lg border p-3 ${statusBg(gasStatus)}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wind size={13} className={statusColor(gasStatus)} />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Gas Level</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${statusColor(gasStatus)}`}>
                    {gasSensor ? `${gasSensor.value}` : "—"}
                    {gasSensor && <span className="text-xs ml-0.5">{gasSensor.unit}</span>}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                    {gasSensor?.name ?? "Sensor N/A"}
                  </div>
                  <div className={`text-[9px] font-bold font-mono uppercase mt-0.5 ${statusColor(gasStatus)}`}>
                    {gasStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Risk Assurance Graph ───────────────────────────────── */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} className="text-amber-400" />
              <div>
                <div className="text-xs font-bold font-mono text-white uppercase tracking-wider">Risk Assurance Analysis</div>
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">7-Day PPE Compliance Trend · {cam.location}</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={riskData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHelmet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradVest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(val: number, name: string) => [`${val}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8" }} />
                <Area type="monotone" dataKey="helmet" name="Helmet Compliance %" stroke="#f59e0b" strokeWidth={2} fill="url(#gradHelmet)" dot={false} />
                <Area type="monotone" dataKey="vest"   name="Vest Compliance %"   stroke="#3b82f6" strokeWidth={2} fill="url(#gradVest)"   dot={false} />
                <Area type="monotone" dataKey="risk"   name="Risk Index %"        stroke="#ef4444" strokeWidth={1.5} fill="url(#gradRisk)" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>

            {/* Summary bar */}
            <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
              {[
                { label: "Avg Helmet Compliance", value: `${Math.round(riskData.reduce((a, d) => a + d.helmet, 0) / riskData.length)}%`, color: "text-amber-400" },
                { label: "Avg Vest Compliance",   value: `${Math.round(riskData.reduce((a, d) => a + d.vest,   0) / riskData.length)}%`, color: "text-blue-400" },
                { label: "Risk Index (Today)",    value: `${riskData[riskData.length - 1]?.risk ?? 0}%`,                                  color: riskData[riskData.length - 1]?.risk > 30 ? "text-red-400" : "text-green-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Per-person breakdown ───────────────────────────────── */}
          {detections.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-3">Per-Person RFID Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-left text-[9px] text-slate-600 uppercase tracking-widest border-b border-slate-800">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">RFID</th>
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Gender</th>
                      <th className="pb-2 pr-4">Helmet</th>
                      <th className="pb-2 pr-4">Vest</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detections.map((d, i) => {
                      const ok = d.hasHelmet && d.hasVest;
                      return (
                        <tr key={i} className="border-b border-slate-800/50 last:border-0">
                          <td className="py-2 pr-4 text-slate-600">{i + 1}</td>
                          <td className="py-2 pr-4 text-slate-400">{d.assignedRfid}</td>
                          <td className="py-2 pr-4 text-white font-bold">{d.assignedName}</td>
                          <td className="py-2 pr-4 text-slate-400">{d.gender === "female" ? "♀ Female" : "♂ Male"}</td>
                          <td className={`py-2 pr-4 font-bold ${d.hasHelmet ? "text-green-400" : "text-red-400"}`}>
                            {d.hasHelmet ? `✓ ${d.helmetConf}%` : `✗ ${d.helmetConf}%`}
                          </td>
                          <td className={`py-2 pr-4 font-bold ${d.hasVest ? "text-green-400" : "text-red-400"}`}>
                            {d.hasVest ? `✓ ${d.vestConf}%` : `✗ ${d.vestConf}%`}
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${ok ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse"}`}>
                              {ok ? "Compliant" : "Violation"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Cameras page ─────────────────────────────────────────────────────

export default function Cameras() {
  const [isAddOpen,     setIsAddOpen]     = useState(false);
  const [editingCam,    setEditingCam]    = useState<CameraType | null>(null);
  const [analyzing,     setAnalyzing]     = useState<Record<string, boolean>>({});
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);

  const videoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const queryClient    = useQueryClient();
  const { data: cameras, isLoading } = useListCameras();
  const { data: workers = [] }       = useListWorkers();
  const createMutation = useCreateCamera();
  const updateMutation = useUpdateCamera();
  const deleteMutation = useDeleteCamera();

  const { media, setMedia, removeMedia } = useCameraMedia();
  const { addLog }                       = useLocalWarningLogs();
  const { addNotification }              = useNotifications();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CameraFormData>({
    resolver: zodResolver(cameraSchema),
    defaultValues: { fps: 30, resolution: "1920x1080" },
  });

  // Enrich workers with gender from the frontend gender map
  const workerRefs = workers.map(w => ({
    rfidId: w.rfidId,
    name:   w.name,
    gender: (WORKER_GENDER_MAP[w.rfidId] ?? "male") as "male" | "female",
  }));

  // Pre-load model when page mounts
  React.useEffect(() => { getDetectionModel().catch(() => {}); }, []);

  const onSubmit = (data: CameraFormData) => {
    if (editingCam) {
      updateMutation.mutate({ id: editingCam.id, data }, {
        onSuccess: () => {
          toast.success("Camera updated");
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
          setEditingCam(null);
        },
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          toast.success("Camera added");
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
          setIsAddOpen(false);
          reset();
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Disconnect and remove this camera?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Camera removed");
          removeMedia(id);
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
        },
      });
    }
  };

  const openEdit = (c: CameraType) => {
    setEditingCam(c);
    reset({ name: c.name, location: c.location, streamUrl: c.streamUrl, ipAddress: c.ipAddress || "", resolution: c.resolution || "1920x1080", fps: c.fps || 30 });
  };

  const handleVideoUpload = useCallback((camId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMedia(camId, { type: "video", url });
    toast.success("Video feed loaded — detection active on dashboard");
    e.target.value = "";
  }, [setMedia]);

  const handlePhotoUpload = useCallback(async (camId: string, cam: CameraType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    e.target.value = "";

    setAnalyzing(prev => ({ ...prev, [camId]: true }));
    toast.info("Analyzing image — running detection...");

    try {
      const img = new window.Image();
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload  = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
      });

      const dets = await detectPPE(img, workerRefs);
      setMedia(camId, { type: "photo", url, photoDetections: dets });

      const violations = dets.filter(d => !d.hasHelmet || !d.hasVest);
      if (dets.length === 0) {
        toast.warning("No persons detected in this image");
      } else if (violations.length === 0) {
        toast.success(`${dets.length} person(s) detected — all PPE compliant`);
      } else {
        toast.error(`${violations.length} PPE violation(s) detected!`);
      }

      const now = new Date().toISOString();
      violations.forEach(v => {
        const missing: string[] = [];
        if (!v.hasHelmet) missing.push("Helmet");
        if (!v.hasVest)   missing.push("Safety Vest");

        const voiceText = `Alert. ${v.assignedName}, ${v.assignedRfid}. PPE violation on ${cam.name}. Missing: ${missing.join(" and ")}.`;

        addLog({
          timestamp:   now,
          cameraId:    camId,
          cameraName:  cam.name,
          zoneName:    cam.location || "Unknown Zone",
          trackId:     `TRK-${Math.floor(Math.random() * 900) + 100}`,
          rfidId:      v.assignedRfid,
          workerName:  v.assignedName,
          missingPPE:  missing,
          alertStatus: "active",
        });

        addNotification({
          timestamp:  now,
          cameraId:   camId,
          cameraName: cam.name,
          workerName: v.assignedName,
          rfidId:     v.assignedRfid,
          missingPPE: missing,
          voiceText,
        });

        if ("speechSynthesis" in window) {
          const utt = new SpeechSynthesisUtterance(voiceText);
          utt.lang = "en-US"; utt.rate = 1.05;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utt);
        }
      });

      // Auto-open detail panel after analysis
      setSelectedCamId(camId);
    } catch {
      toast.error("Detection failed — please try another image");
      URL.revokeObjectURL(url);
    } finally {
      setAnalyzing(prev => ({ ...prev, [camId]: false }));
    }
  }, [setMedia, addLog, addNotification, workerRefs]);

  // Camera currently shown in detail panel
  const selectedCam = cameras?.find(c => c.id === selectedCamId) ?? null;
  const selectedMedia = selectedCamId ? media[selectedCamId] : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Camera Matrix</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Video Feed Configuration · Click a camera to view detailed analysis</p>
        </div>
        <button
          data-testid="button-add-camera"
          onClick={() => { reset(); setIsAddOpen(true); }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2 px-4 rounded-md text-sm uppercase tracking-wider transition-colors"
        >
          <Plus size={16} /> Add Camera
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-500 font-mono animate-pulse">Scanning network...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {cameras?.map(cam => {
            const camMedia = media[cam.id];
            const hasVideo = camMedia?.type === "video";
            const hasPhoto = camMedia?.type === "photo";
            const busy     = analyzing[cam.id];
            const isSelected = selectedCamId === cam.id;

            return (
              <div
                key={cam.id}
                data-testid={`card-camera-${cam.id}`}
                className={`bg-slate-900 border rounded-lg overflow-hidden flex flex-col group relative transition-all duration-200 ${isSelected ? "border-amber-500/60 shadow-lg shadow-amber-500/10" : "border-slate-800 hover:border-slate-700"}`}
              >
                <div className="absolute top-0 right-0 left-0 h-1" style={{ backgroundColor: cam.status === "online" ? "#22c55e" : cam.status === "maintenance" ? "#f59e0b" : "#ef4444" }} />

                {/* Clickable card body */}
                <div
                  className="p-4 flex-1 cursor-pointer"
                  onClick={() => setSelectedCamId(isSelected ? null : cam.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                        <Camera size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white font-mono">{cam.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">{cam.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5 items-center bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <div className={`w-2 h-2 rounded-full ${cam.status === "online" ? "bg-green-500 animate-pulse" : cam.status === "maintenance" ? "bg-amber-500" : "bg-red-500"}`} />
                        <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">{cam.status}</span>
                      </div>
                      {hasPhoto && (
                        <ChevronRight size={14} className={`text-amber-500 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      )}
                    </div>
                  </div>

                  {/* Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 mb-4 bg-slate-950 p-3 rounded border border-slate-800/50">
                    <div>
                      <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">IP Address</span>
                      <span className="text-white">{cam.ipAddress || "DHCP-AUTO"}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">Resolution</span>
                      <span className="text-white">{cam.resolution || "AUTO"} @ {cam.fps}FPS</span>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">Stream URL</span>
                      <span className="text-slate-500 truncate block text-[10px]">{cam.streamUrl}</span>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800 px-2 py-1 rounded">
                      {cam.zoneIds?.length || 0} Zones
                    </span>
                    {hasVideo && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded">
                        <Film size={10} /> Video Feed Active
                      </span>
                    )}
                    {hasPhoto && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
                        <ImageIcon size={10} /> Photo Analyzed
                        {(camMedia?.photoDetections?.length ?? 0) > 0 && (
                          <span className="ml-1">· {camMedia?.photoDetections?.length} person(s)</span>
                        )}
                      </span>
                    )}
                    {busy && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded animate-pulse">
                        <Loader2 size={10} className="animate-spin" /> Detecting...
                      </span>
                    )}
                    {workers.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
                        <Users size={10} /> {workers.length} Workers
                      </span>
                    )}
                  </div>

                  {/* Quick violation summary if photo analyzed */}
                  {hasPhoto && (camMedia?.photoDetections?.length ?? 0) > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <span className="text-[10px] font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-400">
                        👥 {camMedia?.photoDetections?.length} persons
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-1 rounded border font-bold ${
                        camMedia?.photoDetections?.filter(d => !d.hasHelmet).length
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-green-500/10 border-green-500/30 text-green-400"
                      }`}>
                        🪖 Helmet: {camMedia?.photoDetections?.filter(d => !d.hasHelmet).length ?? 0} missing
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-1 rounded border font-bold ${
                        camMedia?.photoDetections?.filter(d => !d.hasVest).length
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-green-500/10 border-green-500/30 text-green-400"
                      }`}>
                        🦺 Vest: {camMedia?.photoDetections?.filter(d => !d.hasVest).length ?? 0} missing
                      </span>
                    </div>
                  )}
                </div>

                {/* Action bar */}
                <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-3 flex-wrap">
                    <button
                      data-testid={`button-upload-video-${cam.id}`}
                      onClick={e => { e.stopPropagation(); videoInputRefs.current[cam.id]?.click(); }}
                      disabled={busy}
                      className="text-slate-400 hover:text-amber-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      <Film size={12} /> {hasVideo ? "Replace Video" : "Upload Video"}
                    </button>

                    <button
                      data-testid={`button-upload-photo-${cam.id}`}
                      onClick={e => { e.stopPropagation(); photoInputRefs.current[cam.id]?.click(); }}
                      disabled={busy}
                      className="text-slate-400 hover:text-blue-400 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      <ImageIcon size={12} /> {hasPhoto ? "Re-Analyze Photo" : "Upload Photo"}
                    </button>

                    {camMedia && (
                      <button
                        data-testid={`button-remove-media-${cam.id}`}
                        onClick={e => { e.stopPropagation(); removeMedia(cam.id); toast.success("Media removed"); }}
                        className="text-slate-400 hover:text-red-400 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors"
                      >
                        <VideoOff size={12} /> Remove
                      </button>
                    )}

                    {hasPhoto && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedCamId(cam.id); }}
                        className="text-slate-400 hover:text-amber-400 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors"
                      >
                        <Maximize2 size={12} /> View Analysis
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={e => { e.stopPropagation(); openEdit(cam); }} className="text-slate-400 hover:text-amber-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                      <Edit2 size={12} /> Config
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(cam.id); }} className="text-slate-400 hover:text-red-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={el => { videoInputRefs.current[cam.id] = el; }}
                  type="file" accept="video/*" className="hidden"
                  onChange={e => handleVideoUpload(cam.id, e)}
                />
                <input
                  ref={el => { photoInputRefs.current[cam.id] = el; }}
                  type="file" accept="image/*" className="hidden"
                  onChange={e => handlePhotoUpload(cam.id, cam, e)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Camera detail modal ────────────────────────────────────── */}
      {selectedCam && (
        <CameraDetailModal
          cam={selectedCam}
          detections={selectedMedia?.photoDetections ?? []}
          photoUrl={selectedMedia?.type === "photo" ? selectedMedia.url : undefined}
          onClose={() => setSelectedCamId(null)}
          onRemovePhoto={() => {
            removeMedia(selectedCam.id);
            setSelectedCamId(null);
            toast.success("Photo removed");
          }}
        />
      )}

      {/* ── Add/Edit dialog ────────────────────────────────────────── */}
      <Dialog open={isAddOpen || !!editingCam} onOpenChange={open => { if (!open) { setIsAddOpen(false); setEditingCam(null); } }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-[500px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono tracking-tight uppercase border-b border-slate-800 pb-2 mb-4 text-white flex items-center gap-2">
              <Settings2 size={18} className="text-amber-500" />
              {editingCam ? "Hardware Config: " + editingCam.name : "Initialize Hardware"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Device Name</label>
                <input {...register("name")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" placeholder="e.g. CAM-ZONE-A1" />
                {errors.name && <p className="text-red-400 text-[10px] uppercase">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Physical Location</label>
                <input {...register("location")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">RTSP/HTTP Stream URL</label>
                <input {...register("streamUrl")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" placeholder="rtsp://admin:pass@ip:554/stream" />
                {errors.streamUrl && <p className="text-red-400 text-[10px] uppercase">{errors.streamUrl.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">IP Address</label>
                <input {...register("ipAddress")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resolution</label>
                <select {...register("resolution")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none">
                  <option value="1920x1080">1080p (FHD)</option>
                  <option value="1280x720">720p (HD)</option>
                  <option value="3840x2160">4K (UHD)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button type="button" onClick={() => { setIsAddOpen(false); setEditingCam(null); }} className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-xs uppercase tracking-wider font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded transition-colors disabled:opacity-50">
                {editingCam ? "Write Config" : "Deploy Device"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
