import React from "react";
import { useListWarningLogs } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Terminal } from "lucide-react";

export default function WarningLogs() {
  const { data: logs, isLoading } = useListWarningLogs();

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono flex items-center gap-2">
            <Terminal size={24} className="text-amber-500" />
            System Audit Trail
          </h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Raw telemetry & violation logs</p>
        </div>
      </div>

      <div className="bg-[#0A0F1C] border border-slate-800 rounded-lg overflow-hidden font-mono shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-900 border-b border-slate-800 flex items-center px-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
          <span className="text-[10px] text-slate-500 ml-4 uppercase tracking-widest">/var/log/metalworks/safety.log</span>
        </div>
        
        <div className="mt-8 p-4 h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar text-xs">
          {isLoading ? (
            <div className="text-amber-500 animate-pulse">Initializing log stream...</div>
          ) : logs?.length === 0 ? (
            <div className="text-slate-500">EOF</div>
          ) : (
            <div className="space-y-1">
              {logs?.map((log, i) => (
                <div key={log.id} className="hover:bg-slate-900/50 px-2 py-0.5 rounded transition-colors flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                  <span className="text-slate-500 shrink-0">[{format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}]</span>
                  <span className="text-blue-400 shrink-0">[{log.cameraName}]</span>
                  <span className="text-purple-400 shrink-0">[{log.zoneName}]</span>
                  
                  <span className="text-slate-300">
                    <span className="text-amber-500">TRK:{log.trackId}</span> 
                    {log.workerName ? ` UID:${log.rfidId} (${log.workerName})` : " (UNREGISTERED)"}
                  </span>
                  
                  <span className="text-red-400 ml-auto font-bold uppercase">
                    VIOLATION: {log.missingPPE.join(", ")}
                  </span>
                  
                  <span className={`shrink-0 uppercase px-1 rounded text-[9px] border ${
                    log.alertStatus === 'active' ? 'border-red-500 text-red-500' : 
                    log.alertStatus === 'acknowledged' ? 'border-amber-500 text-amber-500' : 
                    'border-green-500 text-green-500'
                  }`}>
                    {log.alertStatus}
                  </span>
                </div>
              ))}
              <div className="text-slate-500 mt-4 animate-pulse">_</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
