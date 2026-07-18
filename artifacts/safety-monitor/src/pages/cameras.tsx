import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  useListCameras,
  useCreateCamera,
  useUpdateCamera,
  useDeleteCamera,
  useListWorkers,
  Camera as CameraType,
} from "@workspace/api-client-react";
import { Camera, Settings2, Trash2, Plus, Edit2, Upload, VideoOff, Film, Image as ImageIcon, Loader2, Users } from "lucide-react";
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
import { detectPPE, drawDetections, type PersonDetection } from "../lib/ppe-detection";
import { getDetectionModel } from "../lib/detection-model";

const cameraSchema = z.object({
  name:       z.string().min(1, "Name is required"),
  location:   z.string().min(1, "Location is required"),
  streamUrl:  z.string().url("Valid URL required"),
  ipAddress:  z.string().optional(),
  resolution: z.string().optional(),
  fps:        z.coerce.number().optional(),
});
type CameraFormData = z.infer<typeof cameraSchema>;

/** Show a detected photo with bounding boxes drawn over it — single canvas approach. */
function PhotoDetectionCard({
  cam,
  photoUrl,
  detections,
  onRemove,
}: {
  cam: CameraType;
  photoUrl: string;
  detections: PersonDetection[];
  onRemove: () => void;
}) {
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
    <div className="mt-3 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ImageIcon size={12} className="text-slate-400" />
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            Photo Analysis — {detections.length} Person{detections.length !== 1 ? "s" : ""} Detected
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
      <div>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
      {detections.length > 0 && (
        <div className="p-3 border-t border-slate-800 grid grid-cols-2 gap-2">
          {detections.map((d, i) => (
            <div key={i} className="text-[10px] font-mono bg-slate-900 rounded p-2 border border-slate-800">
              <div className="font-bold text-white mb-1">{d.assignedName}</div>
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

export default function Cameras() {
  const [isAddOpen,   setIsAddOpen]   = useState(false);
  const [editingCam,  setEditingCam]  = useState<CameraType | null>(null);
  const [analyzing,   setAnalyzing]   = useState<Record<string, boolean>>({});

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

  const workerRefs = workers.map(w => ({ rfidId: w.rfidId, name: w.name }));

  // Pre-load model in background when page mounts
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
    toast.info("Analyzing image — running YOLO detection...");

    try {
      // Wait for image to be loadable
      const img = new window.Image();
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload  = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
      });

      const dets = await detectPPE(img, workerRefs);

      setMedia(camId, { type: "photo", url, photoDetections: dets });

      const violations = dets.filter(d => !d.hasHelmet || !d.hasVest);
      if (violations.length === 0 && dets.length === 0) {
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

        const voiceText = `Alert. ${v.assignedName}, ${v.assignedRfid}. PPE violation detected on ${cam.name}. Missing: ${missing.join(" and ")}. Please wear required equipment immediately.`;

        addLog({
          timestamp: now,
          cameraId:   camId,
          cameraName: cam.name,
          zoneName:   cam.location || "Unknown Zone",
          trackId:    `TRK-${Math.floor(Math.random() * 900) + 100}`,
          rfidId:     v.assignedRfid,
          workerName: v.assignedName,
          missingPPE: missing,
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
    } catch {
      toast.error("Detection failed — please try another image");
      URL.revokeObjectURL(url);
    } finally {
      setAnalyzing(prev => ({ ...prev, [camId]: false }));
    }
  }, [setMedia, addLog, addNotification, workerRefs]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Camera Matrix</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Video Feed Configuration</p>
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

            return (
              <div key={cam.id} data-testid={`card-camera-${cam.id}`} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col group relative">
                <div className="absolute top-0 right-0 left-0 h-1" style={{ backgroundColor: cam.status === "online" ? "#22c55e" : cam.status === "maintenance" ? "#f59e0b" : "#ef4444" }} />

                <div className="p-4 flex-1">
                  {/* Camera header */}
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
                    <div className="flex gap-1.5 items-center bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <div className={`w-2 h-2 rounded-full ${cam.status === "online" ? "bg-green-500 animate-pulse" : cam.status === "maintenance" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">{cam.status}</span>
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
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded">
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
                        <Users size={10} /> {workers.length} Workers Tracked
                      </span>
                    )}
                  </div>
                </div>

                {/* Action bar */}
                <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-3 flex-wrap">
                    {/* Video upload */}
                    <button
                      data-testid={`button-upload-video-${cam.id}`}
                      onClick={() => videoInputRefs.current[cam.id]?.click()}
                      disabled={busy}
                      className="text-slate-400 hover:text-amber-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      <Film size={12} /> {hasVideo ? "Replace Video" : "Upload Video"}
                    </button>

                    {/* Photo upload */}
                    <button
                      data-testid={`button-upload-photo-${cam.id}`}
                      onClick={() => photoInputRefs.current[cam.id]?.click()}
                      disabled={busy}
                      className="text-slate-400 hover:text-blue-400 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      <ImageIcon size={12} /> {hasPhoto ? "Re-Analyze Photo" : "Upload Photo"}
                    </button>

                    {camMedia && (
                      <button
                        data-testid={`button-remove-media-${cam.id}`}
                        onClick={() => { removeMedia(cam.id); toast.success("Media removed"); }}
                        className="text-slate-400 hover:text-red-400 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors"
                      >
                        <VideoOff size={12} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(cam)} className="text-slate-400 hover:text-amber-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                      <Edit2 size={12} /> Config
                    </button>
                    <button onClick={() => handleDelete(cam.id)} className="text-slate-400 hover:text-red-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>

                {/* Photo detection result card */}
                {hasPhoto && camMedia?.url && (
                  <div className="px-4 pb-4">
                    <PhotoDetectionCard
                      cam={cam}
                      photoUrl={camMedia.url}
                      detections={camMedia.photoDetections || []}
                      onRemove={() => { removeMedia(cam.id); toast.success("Photo removed"); }}
                    />
                  </div>
                )}

                {/* Hidden file inputs */}
                <input
                  ref={el => { videoInputRefs.current[cam.id] = el; }}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => handleVideoUpload(cam.id, e)}
                />
                <input
                  ref={el => { photoInputRefs.current[cam.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload(cam.id, cam, e)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
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
