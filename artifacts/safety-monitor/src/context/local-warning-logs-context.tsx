import React, { createContext, useContext, useState, useCallback } from "react";

export type LocalWarningLog = {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  zoneName: string;
  trackId: string;
  rfidId: string;
  workerName: string;
  missingPPE: string[];
  alertStatus: "active";
  isLocal: true;
};

type LocalWarningLogsContextType = {
  logs: LocalWarningLog[];
  addLog: (log: Omit<LocalWarningLog, "id" | "isLocal">) => void;
  deleteLog: (id: string) => void;
  clearAll: () => void;
  hiddenApiLogIds: Set<string>;
  hideApiLog: (id: string) => void;
};

const LocalWarningLogsContext = createContext<LocalWarningLogsContextType>({
  logs: [],
  addLog: () => {},
  deleteLog: () => {},
  clearAll: () => {},
  hiddenApiLogIds: new Set(),
  hideApiLog: () => {},
});

export function LocalWarningLogsProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LocalWarningLog[]>([]);
  const [hiddenApiLogIds, setHiddenApiLogIds] = useState<Set<string>>(new Set());

  const addLog = useCallback((log: Omit<LocalWarningLog, "id" | "isLocal">) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLogs(prev => [{ ...log, id, isLocal: true }, ...prev].slice(0, 500));
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setLogs([]);
  }, []);

  const hideApiLog = useCallback((id: string) => {
    setHiddenApiLogIds(prev => new Set([...prev, id]));
  }, []);

  return (
    <LocalWarningLogsContext.Provider value={{ logs, addLog, deleteLog, clearAll, hiddenApiLogIds, hideApiLog }}>
      {children}
    </LocalWarningLogsContext.Provider>
  );
}

export const useLocalWarningLogs = () => useContext(LocalWarningLogsContext);
