import React, { useState } from "react";
import { 
  useListAlerts,
  useGetAlert,
  useAcknowledgeAlert,
  useResolveAlert,
  Alert
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "../hooks/use-auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListAlertsQueryKey } from "@workspace/api-client-react";

export default function Alerts() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: alerts, isLoading } = useListAlerts({ status: filterStatus === 'all' ? undefined : filterStatus });
  const { data: selectedAlert } = useGetAlert(selectedAlertId || "", { query: { enabled: !!selectedAlertId } });
  
  const ackMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();

  const handleAcknowledge = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    if (!user) return;
    ackMutation.mutate({ id, data: { acknowledgedBy: user.username, notes: "Acknowledged via dashboard" } }, {
      onSuccess: () => {
        toast.success("Alert acknowledged");
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        if (selectedAlertId === id) queryClient.invalidateQueries({ queryKey: ['getAlert', id] } as any);
      }
    });
  };

  const handleResolve = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    if (!user) return;
    resolveMutation.mutate({ id, data: { resolvedBy: user.username, notes: "Issue resolved via dashboard" } }, {
      onSuccess: () => {
        toast.success("Alert resolved");
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        if (selectedAlertId === id) setSelectedAlertId(null);
      }
    });
  };

  const getStatusStyle = (status: string) => {
    if (status === 'active') return 'bg-red-500/10 text-red-500 border border-red-500/50 animate-pulse';
    if (status === 'acknowledged') return 'bg-amber-500/10 text-amber-500 border border-amber-500/50';
    return 'bg-green-500/10 text-green-500 border border-green-500/50';
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Incident Log</h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Active & Historical Infractions</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded p-1">
          {['all', 'active', 'acknowledged', 'resolved'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded transition-colors ${filterStatus === status ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider font-semibold text-[10px] text-slate-400 bg-slate-950 font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Personnel</th>
                <th className="px-4 py-3">Zone Location</th>
                <th className="px-4 py-3">Infraction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-mono animate-pulse">Scanning incident records...</td></tr>
              ) : alerts?.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-mono uppercase tracking-widest">No incidents found</td></tr>
              ) : (
                alerts?.map(alert => (
                  <tr 
                    key={alert.id} 
                    onClick={() => setSelectedAlertId(alert.id)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {format(new Date(alert.timestamp), "yyyy-MM-dd HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white font-mono">{alert.workerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {alert.rfidId}</div>
                    </td>
                    <td className="px-4 py-3 text-amber-500 font-mono text-xs">{alert.zoneName}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {alert.missingPPE.map(ppe => (
                          <span key={ppe} className="text-[9px] uppercase bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono border border-red-500/20">
                            - {ppe}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[9px] uppercase font-bold tracking-wider ${getStatusStyle(alert.status)}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {alert.status === 'active' && (
                          <button 
                            onClick={(e) => handleAcknowledge(alert.id, e)}
                            className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-slate-950 border border-amber-500/50 px-2 py-1 rounded text-[10px] uppercase font-bold font-mono transition-colors"
                          >
                            ACK
                          </button>
                        )}
                        {(alert.status === 'active' || alert.status === 'acknowledged') && (
                          <button 
                            onClick={(e) => handleResolve(alert.id, e)}
                            className="bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-slate-950 border border-green-500/50 px-2 py-1 rounded text-[10px] uppercase font-bold font-mono transition-colors"
                          >
                            CLR
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedAlertId} onOpenChange={(open) => !open && setSelectedAlertId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-[600px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono tracking-tight uppercase border-b border-slate-800 pb-2 mb-4 text-white flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-500" />
              Incident Detail #{selectedAlert?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAlert ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Time of Infraction</span>
                  <div className="text-sm text-white font-mono flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" />
                    {format(new Date(selectedAlert.timestamp), "yyyy-MM-dd HH:mm:ss")}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Current Status</span>
                  <span className={`inline-block px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${getStatusStyle(selectedAlert.status)}`}>
                    {selectedAlert.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Subject</span>
                  <div className="text-sm font-bold text-white font-mono">{selectedAlert.workerName}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">RFID: {selectedAlert.rfidId}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Location</span>
                  <div className="text-sm text-white font-mono">{selectedAlert.zoneName}</div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Violations Detected</span>
                <div className="flex gap-2 flex-wrap">
                  {selectedAlert.missingPPE.map(ppe => (
                    <span key={ppe} className="text-xs uppercase bg-red-500/10 text-red-400 px-2 py-1 rounded font-mono border border-red-500/20 flex items-center gap-1">
                      <AlertTriangle size={12} /> Missing {ppe}
                    </span>
                  ))}
                </div>
              </div>

              {selectedAlert.voiceAlertText && (
                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-2">Automated P.A. Broadcast</span>
                  <p className="text-xs font-mono text-amber-500 italic border-l-2 border-amber-500 pl-2">
                    "{selectedAlert.voiceAlertText}"
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                 {selectedAlert.status === 'active' && (
                    <button 
                      onClick={() => handleAcknowledge(selectedAlert.id)}
                      className="px-4 py-2 text-xs uppercase tracking-wider font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 rounded transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                  {(selectedAlert.status === 'active' || selectedAlert.status === 'acknowledged') && (
                    <button 
                      onClick={() => handleResolve(selectedAlert.id)}
                      className="px-4 py-2 text-xs uppercase tracking-wider font-bold bg-green-600 hover:bg-green-500 text-slate-950 rounded transition-colors flex items-center gap-2"
                    >
                      <CheckCircle size={14} /> Clear Incident
                    </button>
                  )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 font-mono animate-pulse">Loading data...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
