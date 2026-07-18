import React, { createContext, useContext, useState, useCallback } from "react";
import type { PersonDetection } from "../lib/ppe-detection";

export type MediaType = "video" | "photo";

export type CameraMedia = {
  type: MediaType;
  url: string;
  /** Pre-computed detections for photo uploads (static). */
  photoDetections?: PersonDetection[];
};

type CameraVideoContextType = {
  media: Record<string, CameraMedia>;
  setMedia: (cameraId: string, m: CameraMedia) => void;
  removeMedia: (cameraId: string) => void;
};

const CameraVideoContext = createContext<CameraVideoContextType>({
  media: {},
  setMedia: () => {},
  removeMedia: () => {},
});

export function CameraVideoProvider({ children }: { children: React.ReactNode }) {
  const [media, setMediaState] = useState<Record<string, CameraMedia>>({});

  const setMedia = useCallback((cameraId: string, m: CameraMedia) => {
    setMediaState(prev => {
      if (prev[cameraId]?.url) URL.revokeObjectURL(prev[cameraId].url);
      return { ...prev, [cameraId]: m };
    });
  }, []);

  const removeMedia = useCallback((cameraId: string) => {
    setMediaState(prev => {
      if (prev[cameraId]?.url) URL.revokeObjectURL(prev[cameraId].url);
      const next = { ...prev };
      delete next[cameraId];
      return next;
    });
  }, []);

  return (
    <CameraVideoContext.Provider value={{ media, setMedia, removeMedia }}>
      {children}
    </CameraVideoContext.Provider>
  );
}

export const useCameraMedia = () => useContext(CameraVideoContext);
