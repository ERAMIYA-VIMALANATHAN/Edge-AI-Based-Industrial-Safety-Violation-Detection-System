import { useEffect, useRef, useState } from 'react';

type WSMessage = {
  type: 'live_feed' | 'sensors' | 'active_alerts';
  data: any;
};

export function useWebSocket() {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(url);
      
      ws.current.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WSMessage;
          setMessages(prev => [...prev.slice(-49), parsed]);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.current.onclose = () => {
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return messages;
}
