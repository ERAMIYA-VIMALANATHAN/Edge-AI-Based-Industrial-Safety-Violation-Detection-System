import React, { createContext, useContext, useState, useCallback } from "react";

type CameraVideoContextType = {
  videos: Record<string, string>; // cameraId -> blobUrl
  uploadVideo: (cameraId: string, file: File) => void;
  removeVideo: (cameraId: string) => void;
};

const CameraVideoContext = createContext<CameraVideoContextType>({
  videos: {},
  uploadVideo: () => {},
  removeVideo: () => {},
});

export function CameraVideoProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<Record<string, string>>({});

  const uploadVideo = useCallback((cameraId: string, file: File) => {
    const url = URL.createObjectURL(file);
    setVideos(prev => {
      if (prev[cameraId]) URL.revokeObjectURL(prev[cameraId]);
      return { ...prev, [cameraId]: url };
    });
  }, []);

  const removeVideo = useCallback((cameraId: string) => {
    setVideos(prev => {
      if (prev[cameraId]) URL.revokeObjectURL(prev[cameraId]);
      const next = { ...prev };
      delete next[cameraId];
      return next;
    });
  }, []);

  return (
    <CameraVideoContext.Provider value={{ videos, uploadVideo, removeVideo }}>
      {children}
    </CameraVideoContext.Provider>
  );
}

export const useCameraVideos = () => useContext(CameraVideoContext);
