import React, { useState } from "react";
import { 
  useListWorkers, 
  useCreateWorker, 
  useUpdateWorker, 
  useDeleteWorker,
  Worker
} from "@workspace/api-client-react";
import { 
  HardHat, ShieldAlert, CheckCircle2, User, Search, Plus, Trash2, Edit2,
  ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListWorkersQueryKey } from "@workspace/api-client-react";

const workerSchema = z.object({
  rfidId: z.string().min(1, "RFID is required"),
  name: z.string().min(1, "Name is required"),
  department: z.string().min(1, "Department is required"),
  status: z.enum(["active", "inactive", "on_leave"]).default("active")
});

type WorkerFormData = z.infer<typeof workerSchema>;

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  
  const queryClient = useQueryClient();
  const { data: workers, isLoading } = useListWorkers();
  const createMutation = useCreateWorker();
  const updateMutation = useUpdateWorker();
  const deleteMutation = useDeleteWorker();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema)
  });

  const filteredWorkers = workers?.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.rfidId.includes(searchTerm) ||
    w.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = (data: WorkerFormData) => {
    if (editingWorker) {
      updateMutation.mutate({ id: editingWorker.id, data }, {
        onSuccess: () => {
          toast.success("Worker updated");
          queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
          setEditingWorker(null);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          toast.success("Worker added");
          queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
          setIsAddOpen(false);
          reset();
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this worker record?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Worker deleted");
          queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
        }
      });
    }
  };

  const openEdit = (w: Worker) => {
    setEditingWorker(w);
    reset({ rfidId: w.rfidId, name: w.name, department: w.department, status: w.status as any });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Personnel Registry</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Manage Workforce & Compliance Tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by ID or Name..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white focus:outline-none focus:border-amber-500 font-mono w-64"
            />
          </div>
          <button 
            onClick={() => { reset(); setIsAddOpen(true); }}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2 px-4 rounded-md text-sm uppercase tracking-wider transition-colors"
          >
            <Plus size={16} /> Add Worker
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider font-semibold text-[10px] text-slate-400 bg-slate-950 font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">RFID / Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Current Zone</th>
                <th className="px-4 py-3">PPE Status</th>
                <th className="px-4 py-3">Compliance</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono animate-pulse">Loading registry...</td></tr>
              ) : filteredWorkers?.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono">No personnel found</td></tr>
              ) : (
                filteredWorkers?.map(w => (
                  <tr key={w.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          <User size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-white font-mono">{w.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">ID: {w.rfidId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{w.department}</td>
                    <td className="px-4 py-3">
                      {w.currentZone ? (
                        <span className="bg-slate-800 text-amber-500 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border border-amber-500/20">
                          {w.currentZone}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs font-mono">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <div className={`p-1 rounded ${w.ppeStatus.hasHelmet ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`} title="Helmet">
                          <HardHat size={14} />
                        </div>
                        <div className={`p-1 rounded ${w.ppeStatus.hasVest ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`} title="Vest">
                          <ShieldCheck size={14} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${w.complianceRate >= 95 ? 'bg-green-500' : w.complianceRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${w.complianceRate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{w.complianceRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {format(new Date(w.lastSeen), "MMM dd, HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(w)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(w.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
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

      <Dialog open={isAddOpen || !!editingWorker} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingWorker(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-[425px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono tracking-tight uppercase border-b border-slate-800 pb-2 mb-4 text-white">
              {editingWorker ? "Edit Worker" : "Register Worker"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">RFID Badge ID</label>
              <input {...register("rfidId")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              {errors.rfidId && <p className="text-red-400 text-[10px] uppercase mt-1">{errors.rfidId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
              <input {...register("name")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none" />
              {errors.name && <p className="text-red-400 text-[10px] uppercase mt-1">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Department</label>
              <select {...register("department")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none">
                <option value="Assembly">Assembly</option>
                <option value="Welding">Welding</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Logistics">Logistics</option>
              </select>
              {errors.department && <p className="text-red-400 text-[10px] uppercase mt-1">{errors.department.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</label>
              <select {...register("status")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
              <button type="button" onClick={() => { setIsAddOpen(false); setEditingWorker(null); }} className="px-4 py-2 text-xs uppercase tracking-wider font-bold text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-xs uppercase tracking-wider font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded transition-colors disabled:opacity-50">
                {editingWorker ? "Save Changes" : "Register"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
