import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  useGetDashboardSummary,
  useGetLiveFeed,
  useGetActiveAlerts,
  useGetLiveSensorData,
  useListWorkers,
  LiveCameraFeed,
  getGetDashboardSummaryQueryKey,
  getGetLiveFeedQueryKey,
  getGetActiveAlertsQueryKey,
  getGetLiveSensorDataQueryKey,
  getListWorkersQueryKey,
} from "@workspace/api-client-react";
import {
  AlertTriangle, HardHat, ShieldAlert, Thermometer,
  Users, Wind, Droplets, Camera, Maximize2, X, Loader2, Activity,
} from "lucide-react";
import { useWebSocket } from "../hooks/use-websocket";
import { useTTSAlert } from "../hooks/use-tts-alert";
import { format } from "date-fns";
import { useCameraMedia } from "../context/camera-video-context";
import { useLocalWarningLogs } from "../context/local-warning-logs-context";
import { useNotifications } from "../context/notification-context";
import { detectPPE, drawDetections, type PersonDetection } from "../lib/ppe-detection";
import { getDetectionModel } from "../lib/detection-model";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const SENSOR_ICONS: Record<string, React.ElementType> = {
  temperature: Thermometer, gas: Wind, humidity: Droplets, co2: Wind,
};

const ZONE_NAMES = ["Welding Zone A", "Assembly Bay", "Chemical Storage", "Maintenance Area"];

function StatCard({ title, value, icon: Icon, color, suffix = "" }: {
  title: string; value: string | number; icon: React.ElementType; color: string; suffix?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center justify-between shadow-lg relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}-500/10 rounded-bl-full -mr-8 -mt-8`} />
      <div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{title}</p>
        <div className="text-2xl font-bold text-white font-mono flex items-baseline">
          {value}<span className="text-sm text-slate-500 ml-1">{suffix}</span>
        </div>
      </div>
      <div className={`p-3 rounded-md bg-${color}-500/10 text-${color}-500`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

// ─── Video detection feed ──────────────────────────────────────────────────

function VideoDetectionFeed({
  feed, videoUrl, workerRefs, onViolations, expanded, onExpandToggle,
}: {
  feed: LiveCameraFeed;
  videoUrl: string;
  workerRefs: { rfidId: string; name: string }[];
  onViolations: (dets: PersonDetection[]) => void;
  expanded?: boolean;
  onExpandToggle?: () => void;
}) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const activeRef  = useRef(true);
  const lastLogRef = useRef(0);
  const [status, setStatus]   = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dims,   setDims]     = useState({ w: 640, h: 360 });
  const [boxes,  setBoxes]    = useState<PersonDetection[]>([]);

  useEffect(() => {
    activeRef.current = true;
    setStatus("loading");
    let tid: ReturnType<typeof setTimeout>;

    getDetectionModel()
      .then(() => {
        if (!activeRef.current) return;
        setStatus("ready");

        async function loop() {
          if (!activeRef.current) return;
          const video  = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && !video.paused && !video.ended && video.readyState >= 2) {
            try {
              const dets = await detectPPE(video, workerRefs);
              if (!activeRef.current) return;
              const ctx = canvas.getContext("2d");
              if (ctx) drawDetections(ctx, dets, canvas.width, canvas.height);
              setBoxes(dets);
              const violations = dets.filter(d => !d.hasHelmet || !d.hasVest);
              if (violations.length > 0 && Date.now() - lastLogRef.current > 10000) {
                lastLogRef.current = Date.now();
                onViolations(violations);
              }
            } catch { /* frame error */ }
          }
          if (activeRef.current) tid = setTimeout(loop, 600);
        }
        loop();
      })
      .catch(() => setStatus("error"));

    return () => { activeRef.current = false; clearTimeout(tid); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  const violations = boxes.filter(b => !b.hasHelmet || !b.hasVest);

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col relative ${expanded ? "h-full" : ""}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-300 font-bold uppercase">{feed.cameraName}</span>
          {status === "loading" && <Loader2 size={11} className="text-amber-500 animate-spin" />}
          {status === "ready" && (
            <span className="text-[9px] text-green-400 font-mono bg-green-500/10 px-1.5 py-0.5 rounded uppercase">AI ACTIVE</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">LIVE</span>
          </div>
          {onExpandToggle && (
            <button onClick={onExpandToggle} className="text-slate-500 hover:text-white transition-colors ml-1">
              {expanded ? <X size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Video + canvas overlay */}
      <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: expanded ? 420 : 190 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay loop muted playsInline
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v) setDims({ w: v.videoWidth || 640, h: v.videoHeight || 360 });
          }}
          className="w-full h-full object-contain"
          style={{ display: "block" }}
        />
        <canvas
          ref={canvasRef}
          width={dims.w} height={dims.h}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        {/* Overlay badges */}
        <div className="absolute bottom-2 left-2 flex gap-1.5 pointer-events-none">
          {violations.length > 0 && (
            <span className="text-[9px] uppercase bg-red-500/85 text-white px-2 py-0.5 rounded font-mono font-bold animate-pulse">
              {violations.length} VIOLATION{violations.length > 1 ? "S" : ""}
            </span>
          )}
          {boxes.length > 0 && (
            <span className="text-[9px] uppercase bg-slate-900/85 text-slate-300 px-2 py-0.5 rounded font-mono">
              {boxes.length} DETECTED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mock canvas feed (no video uploaded) ─────────────────────────────────

function MockFeed({ feed }: { feed: LiveCameraFeed }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width;  i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
    ctx.fillStyle = "#94a3b8"; ctx.font = "12px monospace";
    ctx.fillText(format(new Date(), "yyyy-MM-dd HH:mm:ss") + " REC ●", 10, 20);
    ctx.fillText("CAM: " + feed.cameraName, 10, 36);
    feed.detections?.forEach(det => {
      const isViolation  = !det.hasHelmet || !det.hasVest || !det.hasMask;
      const isCritical   = det.inHazardZone && isViolation;
      const strokeColor  = isCritical ? "#ef4444" : isViolation ? "#f59e0b" : "#22c55e";
      ctx.strokeStyle = strokeColor; ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.width, det.height);
      ctx.fillStyle = strokeColor;
      const lbl = `ID:${det.trackId} ${det.workerName || "UNKNOWN"}`;
      ctx.fillRect(det.x, det.y - 20, ctx.measureText(lbl).width + 8, 20);
      ctx.fillStyle = "#0f172a"; ctx.font = "10px monospace";
      ctx.fillText(lbl, det.x + 4, det.y - 6);
    });
  }, [feed]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-300 font-bold uppercase">{feed.cameraName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${feed.status === "online" ? "bg-green-500 animate-pulse" : feed.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
          <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">{feed.status}</span>
        </div>
      </div>
      <div className="relative aspect-video bg-black w-full overflow-hidden">
        <canvas ref={canvasRef} width={feed.frameWidth || 640} height={feed.frameHeight || 360} className="w-full h-full object-contain" />
      </div>
      <p className="text-[9px] text-slate-600 font-mono text-center py-1 uppercase tracking-wider">
        Upload a video or photo via Cameras to enable AI detection
      </p>
    </div>
  );
}

// ─── Static photo feed ─────────────────────────────────────────────────────

function PhotoFeed({ feed, photoUrl, detections }: { feed: LiveCameraFeed; photoUrl: string; detections: PersonDetection[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      drawDetections(ctx, detections, img.naturalWidth, img.naturalHeight);
    };
    img.src = photoUrl;
  }, [photoUrl, detections]);

  const violations = detections.filter(d => !d.hasHelmet || !d.hasVest);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-300 font-bold uppercase">{feed.cameraName}</span>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono uppercase">PHOTO</span>
        </div>
        {violations.length > 0 && (
          <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono font-bold animate-pulse uppercase">
            {violations.length} VIOLATION{violations.length > 1 ? "S" : ""}
          </span>
        )}
      </div>
      <div className="bg-black">
        <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary,  isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 5000, queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: feeds,    isLoading: loadingFeeds }   = useGetLiveFeed({ query: { refetchInterval: 3000, queryKey: getGetLiveFeedQueryKey() } });
  const { data: alerts }                              = useGetActiveAlerts({ query: { refetchInterval: 3000, queryKey: getGetActiveAlertsQueryKey() } });
  const { data: sensors }                             = useGetLiveSensorData({ query: { refetchInterval: 5000, queryKey: getGetLiveSensorDataQueryKey() } });
  const { data: workers = [] }                        = useListWorkers();

  const { media }          = useCameraMedia();
  const { addLog }         = useLocalWarningLogs();
  const { addNotification } = useNotifications();

  useWebSocket();
  useTTSAlert(alerts);

  const [expandedCam, setExpandedCam] = useState<string | null>(null);

  const workerRefs = workers.map(w => ({ rfidId: w.rfidId, name: w.name }));

  const handleViolations = useCallback((feed: LiveCameraFeed, dets: PersonDetection[]) => {
    const now = new Date().toISOString();
    dets.forEach(d => {
      const missing: string[] = [];
      if (!d.hasHelmet) missing.push("Helmet");
      if (!d.hasVest)   missing.push("Safety Vest");

      const voiceText = `Alert. ${d.assignedName}, ${d.assignedRfid}. PPE violation on ${feed.cameraName}. Missing: ${missing.join(" and ")}. Please wear required equipment immediately.`;

      addLog({
        timestamp: now,
        cameraId: feed.cameraId, cameraName: feed.cameraName,
        zoneName: ZONE_NAMES[Math.floor(Math.random() * ZONE_NAMES.length)],
        trackId: `TRK-${Math.floor(Math.random() * 900) + 100}`,
        rfidId: d.assignedRfid, workerName: d.assignedName,
        missingPPE: missing, alertStatus: "active",
      });

      addNotification({
        timestamp: now,
        cameraId: feed.cameraId, cameraName: feed.cameraName,
        workerName: d.assignedName, rfidId: d.assignedRfid,
        missingPPE: missing, voiceText,
      });

      if ("speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(voiceText);
        utt.lang = "en-US"; utt.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
      }
    });
  }, [addLog, addNotification]);

  if (loadingSummary || loadingFeeds) {
    return <div className="p-6 text-slate-400 font-mono animate-pulse">Initializing Command Center...</div>;
  }

  const expandedFeed = feeds?.find(f => f.cameraId === expandedCam);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Control Center</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Live Factory Overview · Industry Safety Violation Detection</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-slate-300 font-mono uppercase tracking-wider">System Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Camera feeds */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feeds?.map(feed => {
              const camMedia = media[feed.cameraId];
              if (camMedia?.type === "video") {
                return (
                  <div key={feed.cameraId} className="cursor-pointer" onClick={() => setExpandedCam(feed.cameraId)}>
                    <VideoDetectionFeed
                      feed={feed}
                      videoUrl={camMedia.url}
                      workerRefs={workerRefs}
                      onViolations={dets => handleViolations(feed, dets)}
                      onExpandToggle={() => setExpandedCam(feed.cameraId)}
                    />
                    <p className="text-[10px] text-slate-500 font-mono text-center mt-1 uppercase tracking-wider">Click to expand</p>
                  </div>
                );
              }
              if (camMedia?.type === "photo") {
                return (
                  <PhotoFeed
                    key={feed.cameraId}
                    feed={feed}
                    photoUrl={camMedia.url}
                    detections={camMedia.photoDetections || []}
                  />
                );
              }
              return <MockFeed key={feed.cameraId} feed={feed} />;
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="Active Workers"      value={summary?.currentWorkerCount || 0} icon={Users}       color="blue" />
            <StatCard title="Workers in Workspace" value={summary?.workersInHazardZone || 0} icon={AlertTriangle} color="red" />
            <StatCard title="Helmet %"            value={summary?.helmetCompliance || 0}    suffix="%" icon={HardHat}     color="green" />
            <StatCard title="Violations"          value={summary?.activeViolations || 0}    icon={ShieldAlert}  color="amber" />
          </div>

          {/* Active alerts */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col max-h-[380px]">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Active Alerts</h3>
              <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold">{alerts?.length || 0}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {alerts && alerts.length > 0 ? alerts.map(alert => (
                <div key={alert.id} className="bg-slate-950 border border-red-500/30 p-3 rounded text-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
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
                <div className="h-full flex items-center justify-center text-xs text-slate-500 uppercase font-mono py-8">No active alerts</div>
              )}
            </div>
          </div>

          {/* IoT Sensors */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">IoT Sensors</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {sensors?.slice(0, 4).map(sensor => {
                const Icon  = SENSOR_ICONS[sensor.type] || Activity;
                const isCrit = sensor.status === "critical";
                const isWarn = sensor.status === "warning";
                const color  = isCrit ? "text-red-500" : isWarn ? "text-amber-500" : "text-green-500";
                return (
                  <div key={sensor.sensorId} className="flex flex-col items-center p-3 border border-slate-800 rounded bg-slate-950 relative">
                    <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${isCrit ? "bg-red-500 animate-pulse" : isWarn ? "bg-amber-500" : "bg-green-500"}`} />
                    <Icon size={20} className={`mb-2 ${color}`} />
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

      {/* Expanded video modal */}
      {expandedFeed && expandedCam && media[expandedCam]?.type === "video" && (
        <Dialog open onOpenChange={() => setExpandedCam(null)}>
          <DialogContent className="bg-slate-950 border-slate-800 max-w-5xl w-full p-0 overflow-hidden">
            <div className="h-[80vh]">
              <VideoDetectionFeed
                feed={expandedFeed}
                videoUrl={media[expandedCam].url}
                workerRefs={workerRefs}
                onViolations={dets => handleViolations(expandedFeed, dets)}
                expanded
                onExpandToggle={() => setExpandedCam(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
