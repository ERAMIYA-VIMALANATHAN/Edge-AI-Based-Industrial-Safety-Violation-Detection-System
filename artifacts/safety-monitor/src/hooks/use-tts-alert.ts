import { useEffect, useRef, useState, useCallback } from "react";
import { Alert } from "@workspace/api-client-react";

export function useTTSAlert(alerts: Alert[] | undefined) {
  const announcedAlerts = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!alerts) return;

    alerts.forEach(alert => {
      if (
        alert.status === "active" && 
        alert.voiceAlertText && 
        !announcedAlerts.current.has(alert.id)
      ) {
        announcedAlerts.current.add(alert.id);
        
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(alert.voiceAlertText);
          utterance.lang = "en-US";
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    });
  }, [alerts]);
}
