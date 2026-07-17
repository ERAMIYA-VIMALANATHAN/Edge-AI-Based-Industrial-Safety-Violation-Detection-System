import React, { useState } from "react";
import { 
  useListCameras,
  useCreateCamera,
  useUpdateCamera,
  useDeleteCamera,
  Camera as CameraType
} from "@workspace/api-client-react";
import { Camera, Settings2, Trash2, Plus, Edit2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListCamerasQueryKey } from "@workspace/api-client-react";

const cameraSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  streamUrl: z.string().url("Valid URL required"),
  ipAddress: z.string().optional(),
  resolution: z.string().optional(),
  fps: z.coerce.number().optional()
});

type CameraFormData = z.infer<typeof cameraSchema>;

export default function Cameras() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCam, setEditingCam] = useState<CameraType | null>(null);
  
  const queryClient = useQueryClient();
  const { data: cameras, isLoading } = useListCameras();
  const createMutation = useCreateCamera();
  const updateMutation = useUpdateCamera();
  const deleteMutation = useDeleteCamera();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CameraFormData>({
    resolver: zodResolver(cameraSchema),
    defaultValues: { fps: 30, resolution: "1920x1080" }
  });

  const onSubmit = (data: CameraFormData) => {
    if (editingCam) {
      updateMutation.mutate({ id: editingCam.id, data }, {
        onSuccess: () => {
          toast.success("Camera updated");
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
          setEditingCam(null);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          toast.success("Camera added");
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
          setIsAddOpen(false);
          reset();
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Disconnect and remove this camera from the system?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Camera removed");
          queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
        }
      });
    }
  };

  const openEdit = (c: CameraType) => {
    setEditingCam(c);
    reset({
      name: c.name, location: c.location, streamUrl: c.streamUrl,
      ipAddress: c.ipAddress || "", resolution: c.resolution || "1920x1080", fps: c.fps || 30
    });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Camera Matrix</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Video Feed Configuration</p>
        </div>
        <button 
          onClick={() => { reset(); setIsAddOpen(true); }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2 px-4 rounded-md text-sm uppercase tracking-wider transition-colors"
        >
          <Plus size={16} /> Add Camera
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-500 font-mono animate-pulse">Scanning network...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cameras?.map(cam => (
            <div key={cam.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col group relative">
              <div className="absolute top-0 right-0 left-0 h-1" style={{ backgroundColor: cam.status === 'online' ? '#22c55e' : cam.status === 'warning' ? '#f59e0b' : '#ef4444' }}></div>
              <div className="p-4 flex-1">
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
                    <div className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-green-500 animate-pulse' : cam.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">{cam.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 mb-4 bg-slate-950 p-3 rounded border border-slate-800/50">
                  <div>
                    <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">IP Address</span>
                    <span className="text-white">{cam.ipAddress || 'DHCP-AUTO'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">Resolution</span>
                    <span className="text-white">{cam.resolution || 'AUTO'} @ {cam.fps}FPS</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-600 uppercase tracking-widest text-[9px] block mb-1">Stream URL</span>
                    <span className="text-slate-500 truncate block text-[10px]">{cam.streamUrl}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800 px-2 py-1 rounded">
                    {cam.zoneIds?.length || 0} Zones Assigned
                  </span>
                </div>
              </div>
              <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(cam)} className="text-slate-400 hover:text-amber-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                  <Edit2 size={12} /> Config
                </button>
                <button onClick={() => handleDelete(cam.id)} className="text-slate-400 hover:text-red-500 text-xs font-mono flex items-center gap-1 uppercase tracking-wider transition-colors">
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen || !!editingCam} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingCam(null);
        }
      }}>
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
              <button type="button" onClick={() => { setIsAddOpen(false); setEditingCam(null); }} className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
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
