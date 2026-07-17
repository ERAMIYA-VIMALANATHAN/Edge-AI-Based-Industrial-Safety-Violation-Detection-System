import React, { Activity, useEffect, useRef, useState, useCallback } from "react";
import { 
  useGetDashboardSummary, 
  useGetLiveFeed, 
  useGetActiveAlerts,
  useGetLiveSensorData,
  LiveCameraFeed
} from "@workspace/api-client-react";
import { AlertTriangle, HardHat, ShieldAlert, Thermometer, Users, Wind, Droplets, Camera, Maximize2, X, Loader2 } from "lucide-react";
import { useWebSocket } from "../hooks/use-websocket";
import { useTTSAlert } from "../hooks/use-tts-alert";
import { format } from "date-fns";
import { useCameraVideos } from "../context/camera-video-context";
import { useLocalWarningLogs } from "../context/local-warning-logs-context";
import { getDetectionModel } from "../lib/detection-model";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const SENSOR_ICONS: Record<string, React.ElementType> = {
  temperature: Thermometer,
  gas: Wind,
  humidity: Droplets,
  co2: Wind,
};

const ZONE_NAMES = ["Welding Zone A", "Assembly Bay", "Chemical Storage", "Maintenance Area"];
const WORKER_NAMES = ["J. Carter", "M. Santos", "D. Kim", "O. Hassan"];

function StatCard({ title, value, icon: Icon, color, suffix = "" }: { title: string, value: string | number, icon: React.ElementType, color: string, suffix?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center justify-between shadow-lg relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}-500/10 rounded-bl-full -mr-8 -mt-8`}></div>
      <div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{title}</p>
        <div className="text-2xl font-bold text-white font-mono flex items-baseline">
          {value}
          <span className="text-sm text-slate-500 ml-1">{suffix}</span>
        </div>
      </div>
      <div className={`p-3 rounded-md bg-${color}-500/10 text-${color}-500`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

type PPEStatus = { hasHelmet: boolean; hasVest: boolean };
type DetectionBox = { x: number; y: number; w: number; h: number; ppe: PPEStatus; label: string };

function drawBoxes(ctx: CanvasRenderingContext2D, boxes: DetectionBox[], cw: number, ch: number) {
  ctx.clearRect(0, 0, cw, ch);
  boxes.forEach((box, i) => {
    const isViolation = !box.ppe.hasHelmet || !box.ppe.hasVest;
    const color = isViolation ? "#ef4444" : "#22c55e";

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // Corner accents
    const cornerLen = 12;
    ctx.lineWidth = 3;
    [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].forEach(([cx, cy], ci) => {
      ctx.beginPath();
      ctx.moveTo(cx + (ci % 2 === 0 ? cornerLen : -cornerLen), cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + (ci < 2 ? cornerLen : -cornerLen));
      ctx.stroke();
    });

    // Label bg
    ctx.font = "bold 11px monospace";
    const labelText = `Worker-${i + 1}`;
    const lw = ctx.measureText(labelText).width + 10;
    ctx.fillStyle = color;
    ctx.fillRect(box.x, box.y - 22, lw, 22);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(labelText, box.x + 5, box.y - 7);

    // PPE badges below box
    ctx.font = "bold 10px monospace";
    const helmetText = `H:${box.ppe.hasHelmet ? "✓" : "✗"}`;
    const vestText = `V:${box.ppe.hasVest ? "✓" : "✗"}`;
    const hw = ctx.measureText(helmetText).width + 8;
    const vw = ctx.measureText(vestText).width + 8;

    ctx.fillStyle = box.ppe.hasHelmet ? "#22c55e" : "#ef4444";
    ctx.fillRect(box.x, box.y + box.h + 2, hw, 18);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(helmetText, box.x + 4, box.y + box.h + 15);

    ctx.fillStyle = box.ppe.hasVest ? "#22c55e" : "#ef4444";
    ctx.fillRect(box.x + hw + 2, box.y + box.h + 2, vw, 18);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(vestText, box.x + hw + 6, box.y + box.h + 15);
  });
}

function VideoDetectionFeed({
  feed,
  videoUrl,
  onViolations,
  expanded,
  onExpandToggle,
}: {
  feed: LiveCameraFeed;
  videoUrl?: string;
  onViolations?: (boxes: DetectionBox[]) => void;
  expanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ppeMapRef = useRef<Map<string, PPEStatus>>(new Map());
  const activeRef = useRef(true);
  const lastLogRef = useRef<number>(0);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [videoDims, setVideoDims] = useState({ w: 640, h: 360 });
  const [currentBoxes, setCurrentBoxes] = useState<DetectionBox[]>([]);

  const getPPE = useCallback((key: string): PPEStatus => {
    if (!ppeMapRef.current.has(key)) {
      // Randomly assign but keep stable — ~40% chance of violation
      ppeMapRef.current.set(key, {
        hasHelmet: Math.random() > 0.38,
        hasVest: Math.random() > 0.32,
      });
    }
    return ppeMapRef.current.get(key)!;
  }, []);

  useEffect(() => {
    if (!videoUrl) return;
    activeRef.current = true;
    setModelStatus("loading");

    let timeoutId: ReturnType<typeof setTimeout>;

    getDetectionModel()
      .then(model => {
        if (!activeRef.current) return;
        setModelStatus("ready");

        async function runDetect() {
          if (!activeRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && !video.paused && !video.ended && video.readyState >= 2) {
            try {
              const preds = await (model as { detect: (v: HTMLVideoElement) => Promise<Array<{class: string; score: number; bbox: [number, number, number, number]}>> }).detect(video);
              if (!activeRef.current) return;

              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              const persons = preds.filter(p => p.class === "person" && p.score > 0.45);
              const boxes: DetectionBox[] = persons.map((p, i) => {
                const [x, y, w, h] = p.bbox;
                const key = `${Math.round(x / 100)}_${Math.round(y / 100)}`;
                return { x, y, w, h, ppe: getPPE(key), label: `Worker-${i + 1}` };
              });

              setCurrentBoxes(boxes);
              drawBoxes(ctx, boxes, canvas.width, canvas.height);

              // Throttle violation logging: max once per 10s per feed
              const violations = boxes.filter(b => !b.ppe.hasHelmet || !b.ppe.hasVest);
              if (violations.length > 0 && Date.now() - lastLogRef.current > 10000) {
                lastLogRef.current = Date.now();
                onViolations?.(violations);
              }
            } catch {
              // ignore frame errors
            }
          }
          if (activeRef.current) {
            timeoutId = setTimeout(runDetect, 500);
          }
        }

        runDetect();
      })
      .catch(() => setModelStatus("error"));

    return () => {
      activeRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [videoUrl, getPPE, onViolations]);

  // Redraw boxes after canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoUrl) return;
    const ctx = canvas.getContext("2d");
    if (ctx) drawBoxes(ctx, currentBoxes, canvas.width, canvas.height);
  }, [currentBoxes, videoDims, videoUrl]);

  const handleMetadata = () => {
    const v = videoRef.current;
    if (v) setVideoDims({ w: v.videoWidth || 640, h: v.videoHeight || 360 });
  };

  if (!videoUrl) {
    // Mock canvas feed (original behavior)
    return <MockCanvasFeed feed={feed} />;
  }

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col relative group ${expanded ? "h-full" : ""}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-300 font-bold uppercase">{feed.cameraName}</span>
          {modelStatus === "loading" && <Loader2 size={11} className="text-amber-500 animate-spin" />}
          {modelStatus === "ready" && <span className="text-[9px] text-green-400 uppercase font-mono tracking-wider bg-green-500/10 px-1.5 py-0.5 rounded">AI ACTIVE</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">LIVE</span>
          </div>
          {onExpandToggle && (
            <button onClick={onExpandToggle} className="text-slate-500 hover:text-white transition-colors ml-1">
              {expanded ? <X size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Video + Canvas overlay */}
      <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: expanded ? 400 : 180 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={handleMetadata}
          className="w-full h-full object-contain"
          style={{ display: "block" }}
        />
        <canvas
          ref={canvasRef}
          width={videoDims.w}
          height={videoDims.h}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        {/* Overlay info */}
        <div className="absolute bottom-2 left-2 flex gap-1.5 pointer-events-none">
          {currentBoxes.filter(b => !b.ppe.hasHelmet || !b.ppe.hasVest).length > 0 && (
            <span className="text-[9px] uppercase bg-red-500/80 text-white px-2 py-0.5 rounded font-mono font-bold animate-pulse">
              {currentBoxes.filter(b => !b.ppe.hasHelmet || !b.ppe.hasVest).length} VIOLATION{currentBoxes.filter(b => !b.ppe.hasHelmet || !b.ppe.hasVest).length > 1 ? "S" : ""}
            </span>
          )}
          {currentBoxes.length > 0 && (
            <span className="text-[9px] uppercase bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded font-mono">
              {currentBoxes.length} DETECTED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Original mock canvas feed component
function MockCanvasFeed({ feed }: { feed: LiveCameraFeed }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.fillText(format(new Date(), "yyyy-MM-dd HH:mm:ss") + " REC ●", 10, 20);
    ctx.fillText("CAM: " + feed.cameraName, 10, 36);

    feed.detections?.forEach(det => {
      const isViolation = !det.hasHelmet || !det.hasVest || !det.hasMask;
      const isCritical = det.inHazardZone && isViolation;
      const strokeColor = isCritical ? "#ef4444" : isViolation ? "#f59e0b" : "#22c55e";
      ctx.strokeStyle = strokeColor; ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.width, det.height);
      ctx.fillStyle = strokeColor;
      const labelText = `ID:${det.trackId} ${det.workerName || "UNKNOWN"}`;
      ctx.fillRect(det.x, det.y - 20, ctx.measureText(labelText).width + 8, 20);
      ctx.fillStyle = "#0f172a"; ctx.font = "10px monospace";
      ctx.fillText(labelText, det.x + 4, det.y - 6);
      const statusText = `H:${det.hasHelmet ? "✓" : "✗"} V:${det.hasVest ? "✓" : "✗"} M:${det.hasMask ? "✓" : "✗"}`;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(det.x, det.y + det.height, ctx.measureText(statusText).width + 8, 16);
      ctx.fillStyle = "#e2e8f0"; ctx.fillText(statusText, det.x + 4, det.y + det.height + 12);
    });
  }, [feed]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col relative group">
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-300 font-bold uppercase">{feed.cameraName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${feed.status === "online" ? "bg-green-500 animate-pulse" : feed.status === "warning" ? "bg-amber-500" : "bg-red-500"}`}></div>
          <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">{feed.status}</span>
        </div>
      </div>
      <div className="relative aspect-video bg-black w-full overflow-hidden">
        <canvas ref={canvasRef} width={feed.frameWidth || 640} height={feed.frameHeight || 360} className="w-full h-full object-contain" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 5000 } });
  const { data: feeds, isLoading: loadingFeeds } = useGetLiveFeed({ query: { refetchInterval: 3000 } });
  const { data: alerts, isLoading: loadingAlerts } = useGetActiveAlerts({ query: { refetchInterval: 3000 } });
  const { data: sensors } = useGetLiveSensorData({ query: { refetchInterval: 5000 } });

  const { videos } = useCameraVideos();
  const { addLog } = useLocalWarningLogs();
  const wsMessages = useWebSocket();
  useTTSAlert(alerts);

  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);

  const handleViolations = useCallback((feed: LiveCameraFeed, boxes: DetectionBox[]) => {
    boxes.forEach((box, i) => {
      const missing: string[] = [];
      if (!box.ppe.hasHelmet) missing.push("Helmet");
      if (!box.ppe.hasVest) missing.push("Safety Vest");

      addLog({
        timestamp: new Date().toISOString(),
        cameraId: feed.cameraId,
        cameraName: feed.cameraName,
        zoneName: ZONE_NAMES[Math.floor(Math.random() * ZONE_NAMES.length)],
        trackId: `TRK-${Math.floor(Math.random() * 900) + 100}`,
        rfidId: "UNREGISTERED",
        workerName: "",
        missingPPE: missing,
        alertStatus: "active",
      });

      // TTS voice alert
      if ("speechSynthesis" in window && missing.length > 0) {
        const msg = `Alert. Worker ${i + 1} detected on ${feed.cameraName} without ${missing.join(" and ")}. Please wear required PPE immediately.`;
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = "en-US";
        utterance.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    });
  }, [addLog]);

  if (loadingSummary || loadingFeeds) {
    return <div className="p-6 text-slate-400 font-mono animate-pulse">Initializing Command Center...</div>;
  }

  const expandedFeed = feeds?.find(f => f.cameraId === expandedCamera);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Control Center</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Live Factory Overview</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-300 font-mono uppercase tracking-wider">System Live</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Cameras */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feeds?.map(feed => (
              <div
                key={feed.cameraId}
                data-testid={`camera-feed-${feed.cameraId}`}
                className="cursor-pointer"
                onClick={() => videos[feed.cameraId] && setExpandedCamera(feed.cameraId)}
              >
                <VideoDetectionFeed
                  feed={feed}
                  videoUrl={videos[feed.cameraId]}
                  onViolations={boxes => handleViolations(feed, boxes)}
                  onExpandToggle={videos[feed.cameraId] ? () => setExpandedCamera(feed.cameraId) : undefined}
                />
                {videos[feed.cameraId] && (
                  <p className="text-[10px] text-slate-500 font-mono text-center mt-1 uppercase tracking-wider">Click to expand</p>
                )}
              </div>
            ))}
            {(!feeds || feeds.length === 0) && (
              <div className="col-span-2 aspect-video bg-slate-900 border border-slate-800 border-dashed rounded-lg flex items-center justify-center text-slate-500 font-mono text-sm uppercase">
                No active camera feeds
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stats & Alerts */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="Active Workers" value={summary?.currentWorkerCount || 0} icon={Users} color="blue" />
            <StatCard title="Workers in Workspace" value={summary?.workersInHazardZone || 0} icon={AlertTriangle} color="red" />
            <StatCard title="Helmet %" value={summary?.helmetCompliance || 0} suffix="%" icon={HardHat} color="green" />
            <StatCard title="Violations" value={summary?.activeViolations || 0} icon={ShieldAlert} color="amber" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Active Alerts</h3>
              <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold">{alerts?.length || 0}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {alerts && alerts.length > 0 ? alerts.map(alert => (
                <div key={alert.id} className="bg-slate-950 border border-red-500/30 p-3 rounded text-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-red-400 font-mono">{alert.workerName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{format(new Date(alert.timestamp), "HH:mm:ss")}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-1">Zone: <span className="text-amber-500">{alert.zoneName}</span></p>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {alert.missingPPE.map(ppe => (
                      <span key={ppe} className="text-[9px] uppercase bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono border border-red-500/20">
                        Missing {ppe}
                      </span>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 uppercase font-mono py-8">
                  No active alerts
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">IoT Sensors</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {sensors?.slice(0, 4).map(sensor => {
                const Icon = SENSOR_ICONS[sensor.type] || Activity;
                const isCrit = sensor.status === "critical";
                const isWarn = sensor.status === "warning";
                const colorText = isCrit ? "text-red-500" : isWarn ? "text-amber-500" : "text-green-500";
                return (
                  <div key={sensor.sensorId} className="flex flex-col items-center p-3 border border-slate-800 rounded bg-slate-950 relative">
                    <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${isCrit ? "bg-red-500 animate-pulse" : isWarn ? "bg-amber-500" : "bg-green-500"}`}></div>
                    <Icon size={20} className={`mb-2 ${colorText}`} />
                    <div className="text-lg font-mono font-bold text-white leading-none mb-1">
                      {sensor.value.toFixed(1)}<span className="text-[10px] text-slate-500 ml-0.5">{sensor.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{sensor.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded camera modal */}
      {expandedFeed && expandedCamera && videos[expandedCamera] && (
        <Dialog open={!!expandedCamera} onOpenChange={() => setExpandedCamera(null)}>
          <DialogContent className="bg-slate-950 border-slate-800 max-w-5xl w-full p-0 overflow-hidden">
            <div className="flex flex-col h-[80vh]">
              <VideoDetectionFeed
                feed={expandedFeed}
                videoUrl={videos[expandedCamera]}
                onViolations={boxes => handleViolations(expandedFeed, boxes)}
                expanded
                onExpandToggle={() => setExpandedCamera(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
