import React, { useState, useEffect, useRef } from "react";
import { 
  useListZones,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
  useListCameras,
  SafetyZone,
  ZonePolygonPoint
} from "@workspace/api-client-react";
import { Map as MapIcon, Plus, Trash2, Edit2, Move } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListZonesQueryKey } from "@workspace/api-client-react";

// For demo purposes, we will just use basic polygon inputs rather than full drawing,
// but we will render the polygon visually on a canvas.

const zoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cameraId: z.string().min(1, "Camera is required"),
  zoneType: z.enum(["hazard", "safe", "restricted"]),
  requiredPPE: z.object({
    hasHelmet: z.boolean(),
    hasVest: z.boolean(),
    hasMask: z.boolean()
  }),
  color: z.string().optional()
});

type ZoneFormData = z.infer<typeof zoneSchema>;

function PolygonVisualizer({ polygon, color }: { polygon: ZonePolygonPoint[], color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = "#1e293b";
    for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

    if (!polygon || polygon.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = (color || "#f59e0b") + "40"; // 25% opacity
    ctx.fill();
    ctx.strokeStyle = color || "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vertices
    ctx.fillStyle = "#ffffff";
    polygon.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2*Math.PI);
      ctx.fill();
    });

  }, [polygon, color]);

  return (
    <div className="relative border border-slate-800 bg-slate-950 rounded overflow-hidden aspect-video">
      <div className="absolute top-2 left-2 text-[10px] text-slate-500 font-mono uppercase bg-slate-900 px-2 py-1 rounded z-10 border border-slate-800">
        Zone Matrix Preview
      </div>
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={360} 
        className="w-full h-full object-contain pointer-events-none"
      />
    </div>
  );
}

export default function Zones() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<SafetyZone | null>(null);
  const [selectedZone, setSelectedZone] = useState<SafetyZone | null>(null);
  
  const queryClient = useQueryClient();
  const { data: zones, isLoading } = useListZones();
  const { data: cameras } = useListCameras();
  const createMutation = useCreateZone();
  const updateMutation = useUpdateZone();
  const deleteMutation = useDeleteZone();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      zoneType: "hazard",
      requiredPPE: { hasHelmet: true, hasVest: true, hasMask: false },
      color: "#ef4444"
    }
  });

  const onSubmit = (data: ZoneFormData) => {
    // Generate dummy polygon if new
    const dummyPolygon = editingZone?.polygon || [
      { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }, { x: 100, y: 250 }
    ];

    const payload = { ...data, polygon: dummyPolygon };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: payload }, {
        onSuccess: () => {
          toast.success("Zone topology updated");
          queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
          setEditingZone(null);
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success("Zone initialized");
          queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
          setIsAddOpen(false);
          reset();
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Erase this zone mapping?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Zone erased");
          if (selectedZone?.id === id) setSelectedZone(null);
          queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
        }
      });
    }
  };

  const openEdit = (z: SafetyZone) => {
    setEditingZone(z);
    reset({
      name: z.name,
      cameraId: z.cameraId,
      zoneType: z.zoneType,
      requiredPPE: z.requiredPPE,
      color: z.color || "#ef4444"
    });
  };

  const getTypeColor = (type: string) => {
    if (type === 'hazard') return 'text-red-500 border-red-500/50 bg-red-500/10';
    if (type === 'restricted') return 'text-purple-500 border-purple-500/50 bg-purple-500/10';
    return 'text-green-500 border-green-500/50 bg-green-500/10';
  };

  useEffect(() => {
    if (zones && zones.length > 0 && !selectedZone) {
      setSelectedZone(zones[0]);
    }
  }, [zones, selectedZone]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Geospatial Zones</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Define Safety Perimeters</p>
        </div>
        <button 
          onClick={() => { reset(); setIsAddOpen(true); }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2 px-4 rounded-md text-sm uppercase tracking-wider transition-colors"
        >
          <Plus size={16} /> Map New Zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
           <div className="overflow-x-auto flex-1">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="uppercase tracking-wider font-semibold text-[10px] text-slate-400 bg-slate-950 font-mono border-b border-slate-800">
                 <tr>
                   <th className="px-4 py-3">Zone Identifier</th>
                   <th className="px-4 py-3">Type</th>
                   <th className="px-4 py-3">Assigned Camera</th>
                   <th className="px-4 py-3">Req. PPE</th>
                   <th className="px-4 py-3 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {isLoading ? (
                   <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-mono animate-pulse">Loading topology...</td></tr>
                 ) : (
                   zones?.map(z => (
                     <tr 
                       key={z.id} 
                       onClick={() => setSelectedZone(z)}
                       className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedZone?.id === z.id ? 'bg-slate-800/80 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'}`}
                     >
                       <td className="px-4 py-3">
                         <div className="font-bold text-white font-mono">{z.name}</div>
                         <div className="text-[10px] text-slate-500 font-mono">Vertices: {z.polygon.length}</div>
                       </td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${getTypeColor(z.zoneType)}`}>
                           {z.zoneType}
                         </span>
                       </td>
                       <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                         {cameras?.find(c => c.id === z.cameraId)?.name || z.cameraId}
                       </td>
                       <td className="px-4 py-3">
                         <div className="flex gap-1">
                           {z.requiredPPE.hasHelmet && <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">HELMET</span>}
                           {z.requiredPPE.hasVest && <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">VEST</span>}
                           {z.requiredPPE.hasMask && <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">MASK</span>}
                         </div>
                       </td>
                       <td className="px-4 py-3 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={(e) => { e.stopPropagation(); openEdit(z); }} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors">
                             <Edit2 size={14} />
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); handleDelete(z.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Geometry Viewer</h3>
            {selectedZone ? (
              <>
                <PolygonVisualizer polygon={selectedZone.polygon} color={selectedZone.color || "#f59e0b"} />
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block mb-1">Target</span>
                    <span className="text-white">{selectedZone.name}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block mb-1">Polygons</span>
                    <span className="text-amber-500">{selectedZone.polygon.length} nodes</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="aspect-video border border-slate-800 border-dashed rounded flex items-center justify-center text-slate-500 font-mono text-[10px] uppercase">
                Select a zone to preview
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAddOpen || !!editingZone} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingZone(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-[425px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono tracking-tight uppercase border-b border-slate-800 pb-2 mb-4 text-white flex items-center gap-2">
              <MapIcon size={18} className="text-amber-500" />
              {editingZone ? "Modify Geometry" : "Map New Zone"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Zone Identifier</label>
              <input {...register("name")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" placeholder="e.g. Sector 7G" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Source Camera</label>
              <select {...register("cameraId")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none">
                {cameras?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Zone Classification</label>
              <select {...register("zoneType")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none">
                <option value="hazard">Hazard (Red)</option>
                <option value="restricted">Restricted (Purple)</option>
                <option value="safe">Safe (Green)</option>
              </select>
            </div>
            
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Required PPE Enforcement</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 font-mono cursor-pointer">
                  <input type="checkbox" {...register("requiredPPE.hasHelmet")} className="accent-amber-500 bg-slate-950 border-slate-800 rounded" />
                  Helmet
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 font-mono cursor-pointer">
                  <input type="checkbox" {...register("requiredPPE.hasVest")} className="accent-amber-500 bg-slate-950 border-slate-800 rounded" />
                  Vest
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 font-mono cursor-pointer">
                  <input type="checkbox" {...register("requiredPPE.hasMask")} className="accent-amber-500 bg-slate-950 border-slate-800 rounded" />
                  Mask
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button type="button" onClick={() => { setIsAddOpen(false); setEditingZone(null); }} className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-white transition-colors">
                Abort
              </button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-xs uppercase tracking-wider font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded transition-colors disabled:opacity-50">
                Compile Node
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
