import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const WebSocketContext = createContext(null);

const WS_URL = 'wss://r74g32bvka.execute-api.us-east-2.amazonaws.com/production/';

export function WebSocketProvider({ children }) {
  const [sensorData, setSensorData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    console.log('Connecting to WebSocket:', WS_URL);
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // The sensor data might be nested or direct depending on the "send-iot-payload" route
        // Based on the example payload provided:
        // { "device": "...", "temperature": ..., "humidity": ..., "moisture": ... }
        if (data.temperature !== undefined || data.moisture !== undefined || data.water_level !== undefined) {
          setSensorData(data);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected. Reconnecting in 5s...');
      setIsConnected(false);
      reconnectTimeout.current = setTimeout(connect, 5000);
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      ws.current.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  const sendCommand = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'publish-command',
        message: message
      };
      console.log('Sending command:', payload);
      ws.current.send(JSON.stringify(payload));
    } else {
      console.error('WebSocket not connected. Cannot send command:', message);
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ sensorData, isConnected, sendCommand }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
