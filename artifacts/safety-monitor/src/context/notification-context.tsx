import React, { createContext, useContext, useState, useCallback } from "react";

export type ViolationNotification = {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  workerName: string;
  rfidId: string;
  missingPPE: string[];
  voiceText: string;
  read: boolean;
};

type NotificationContextType = {
  notifications: ViolationNotification[];
  unreadCount: number;
  addNotification: (n: Omit<ViolationNotification, "id" | "read">) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
  dismiss: () => {},
  clearAll: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<ViolationNotification[]>([]);

  const addNotification = useCallback((n: Omit<ViolationNotification, "id" | "read">) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotifications(prev => [{ ...n, id, read: false }, ...prev].slice(0, 100));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, dismiss, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
