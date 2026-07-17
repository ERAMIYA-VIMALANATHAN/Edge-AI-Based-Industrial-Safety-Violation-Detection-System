import React, { useMemo } from "react";
import { useListWarningLogs } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Terminal, Trash2, X } from "lucide-react";
import { useLocalWarningLogs } from "../context/local-warning-logs-context";
import { toast } from "sonner";

export default function WarningLogs() {
  const { data: apiLogs, isLoading } = useListWarningLogs();
  const { logs: localLogs, deleteLog, clearAll, hiddenApiLogIds, hideApiLog } = useLocalWarningLogs();

  // Merge: local logs first (newest), then API logs filtered by hidden IDs
  const mergedLogs = useMemo(() => {
    const apiVisible = (apiLogs || [])
      .filter(l => !hiddenApiLogIds.has(l.id))
      .map(l => ({ ...l, isLocal: false as const }));
    const combined = [
      ...localLogs,
      ...apiVisible,
    ];
    // Sort by timestamp descending
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [apiLogs, localLogs, hiddenApiLogIds]);

  const handleDeleteLocal = (id: string) => {
    deleteLog(id);
    toast.success("Log entry removed");
  };

  const handleDeleteApi = (id: string) => {
    hideApiLog(id);
    toast.success("Log entry removed");
  };

  const handleClearAll = () => {
    if (confirm("Clear all log entries from this view? API logs will reappear on next load.")) {
      clearAll();
      // Also clear all currently visible API logs
      (apiLogs || []).forEach(l => hideApiLog(l.id));
      toast.success("All logs cleared");
    }
  };

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
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {mergedLogs.length} entries
            {localLogs.length > 0 && (
              <span className="ml-2 text-amber-500">{localLogs.length} live detected</span>
            )}
          </span>
          {mergedLogs.length > 0 && (
            <button
              data-testid="button-clear-all-logs"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded font-mono transition-colors"
            >
              <Trash2 size={11} /> Clear All
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#0A0F1C] border border-slate-800 rounded-lg overflow-hidden font-mono shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-900 border-b border-slate-800 flex items-center px-4 z-10">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
          <span className="text-[10px] text-slate-500 ml-4 uppercase tracking-widest">/var/log/metalworks/safety.log</span>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">
            {mergedLogs.length > 0 ? `${mergedLogs.length} records` : "EOF"}
          </span>
        </div>

        <div className="mt-8 p-4 h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar text-xs">
          {isLoading ? (
            <div className="text-amber-500 animate-pulse">Initializing log stream...</div>
          ) : mergedLogs.length === 0 ? (
            <div className="text-slate-500">EOF — No violation logs recorded</div>
          ) : (
            <div className="space-y-1">
              {mergedLogs.map(log => {
                const isLocal = "isLocal" in log && log.isLocal;
                return (
                  <div
                    key={log.id}
                    data-testid={`log-entry-${log.id}`}
                    className={`group hover:bg-slate-900/60 px-2 py-1 rounded transition-colors flex flex-wrap gap-x-3 gap-y-1 items-baseline relative ${isLocal ? "border-l-2 border-amber-500/40 pl-3" : ""}`}
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0">
                      [{format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}]
                    </span>

                    {/* Source badge */}
                    {isLocal && (
                      <span className="text-[9px] uppercase bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded border border-amber-500/30 font-bold shrink-0">LIVE</span>
                    )}

                    <span className="text-blue-400 shrink-0">[{log.cameraName}]</span>
                    <span className="text-purple-400 shrink-0">[{log.zoneName}]</span>

                    <span className="text-slate-300">
                      <span className="text-amber-500">TRK:{log.trackId}</span>
                      {log.workerName
                        ? ` UID:${log.rfidId} (${log.workerName})`
                        : log.rfidId && log.rfidId !== "UNREGISTERED"
                          ? ` UID:${log.rfidId}`
                          : " (UNREGISTERED)"}
                    </span>

                    <span className="text-red-400 font-bold uppercase">
                      VIOLATION: {log.missingPPE.join(", ")}
                    </span>

                    <span className={`shrink-0 uppercase px-1 rounded text-[9px] border ${
                      log.alertStatus === "active" ? "border-red-500 text-red-500" :
                      log.alertStatus === "acknowledged" ? "border-amber-500 text-amber-500" :
                      "border-green-500 text-green-500"
                    }`}>
                      {log.alertStatus}
                    </span>

                    {/* Delete button — always visible for local, hover for API */}
                    <button
                      data-testid={`button-delete-log-${log.id}`}
                      onClick={() => isLocal ? handleDeleteLocal(log.id) : handleDeleteApi(log.id)}
                      className={`shrink-0 ml-auto transition-colors text-slate-700 hover:text-red-400 ${isLocal ? "" : "opacity-0 group-hover:opacity-100"}`}
                      title="Delete log entry"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <div className="text-slate-500 mt-4 animate-pulse">_</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
