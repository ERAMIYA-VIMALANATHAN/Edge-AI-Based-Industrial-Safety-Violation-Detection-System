import React, { Activity, useEffect, useRef, useState } from "react";
import { 
  useGetDashboardSummary, 
  useGetLiveFeed, 
  useGetActiveAlerts,
  useGetLiveSensorData,
  Detection,
  LiveCameraFeed
} from "@workspace/api-client-react";
import { AlertTriangle, HardHat, ShieldAlert, ShieldCheck, Thermometer, UserCheck, Users, Wind, Droplets, Camera } from "lucide-react";
import { useWebSocket } from "../hooks/use-websocket";
import { useTTSAlert } from "../hooks/use-tts-alert";
import { format } from "date-fns";

const SENSOR_ICONS: Record<string, React.ElementType> = {
  temperature: Thermometer,
  gas: Wind,
  humidity: Droplets,
  co2: Wind,
};

function StatCard({ title, value, icon: Icon, color, suffix = "" }: { title: string, value: string | number, icon: any, color: string, suffix?: string }) {
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

function CameraFeed({ feed }: { feed: LiveCameraFeed }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw dummy camera background pattern
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add grid lines for tech effect
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Add time overlay
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.fillText(format(new Date(), "yyyy-MM-dd HH:mm:ss") + " REC \u25CF", 10, 20);
    ctx.fillText("CAM: " + feed.cameraName, 10, 36);

    // Draw detections
    feed.detections?.forEach(det => {
      // Base color based on violation
      const isViolation = !det.hasHelmet || !det.hasVest || !det.hasMask;
      const isCritical = det.inHazardZone && isViolation;
      const strokeColor = isCritical ? "#ef4444" : isViolation ? "#f59e0b" : "#22c55e";

      // Draw bounding box
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.width, det.height);

      // Draw label background
      ctx.fillStyle = strokeColor;
      const labelText = `ID:${det.trackId} ${det.workerName || "UNKNOWN"}`;
      ctx.fillRect(det.x, det.y - 20, ctx.measureText(labelText).width + 8, 20);
      
      // Draw label text
      ctx.fillStyle = "#0f172a";
      ctx.font = "10px monospace";
      ctx.fillText(labelText, det.x + 4, det.y - 6);

      // Draw PPE Status mini-badges
      const statusText = `H:${det.hasHelmet?"\u2713":"\u2717"} V:${det.hasVest?"\u2713":"\u2717"} M:${det.hasMask?"\u2713":"\u2717"}`;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(det.x, det.y + det.height, ctx.measureText(statusText).width + 8, 16);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(statusText, det.x + 4, det.y + det.height + 12);
      
      if (det.inHazardZone) {
         ctx.fillStyle = "#ef4444";
         ctx.fillRect(det.x, det.y + det.height + 16, ctx.measureText(det.zoneName).width + 8, 16);
         ctx.fillStyle = "#ffffff";
         ctx.fillText(det.zoneName, det.x + 4, det.y + det.height + 28);
      }
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
        <canvas 
          ref={canvasRef} 
          width={feed.frameWidth || 640} 
          height={feed.frameHeight || 360}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 5000 } });
  const { data: feeds, isLoading: loadingFeeds } = useGetLiveFeed({ query: { refetchInterval: 3000 } });
  const { data: alerts, isLoading: loadingAlerts } = useGetActiveAlerts({ query: { refetchInterval: 3000 } });
  const { data: sensors, isLoading: loadingSensors } = useGetLiveSensorData({ query: { refetchInterval: 5000 } });
  
  // Real-time supplements
  const wsMessages = useWebSocket();
  useTTSAlert(alerts);

  if (loadingSummary || loadingFeeds) {
    return <div className="p-6 text-slate-400 font-mono animate-pulse">Initializing Command Center...</div>;
  }

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
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {feeds?.map(feed => (
               <CameraFeed key={feed.cameraId} feed={feed} />
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
                <div key={alert.id} className="bg-slate-950 border border-red-500/30 p-3 rounded text-sm relative overflow-hidden group">
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
                const colorClass = isCrit ? "text-red-500 bg-red-500/10" : isWarn ? "text-amber-500 bg-amber-500/10" : "text-green-500 bg-green-500/10";
                return (
                  <div key={sensor.sensorId} className="flex flex-col items-center p-3 border border-slate-800 rounded bg-slate-950 relative">
                    <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${isCrit ? "bg-red-500 animate-pulse" : isWarn ? "bg-amber-500" : "bg-green-500"}`}></div>
                    <Icon size={20} className={`mb-2 ${colorClass.split(" ")[0]}`} />
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
    </div>
  );
}
