import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function subscribeSimulation(simulationId, onProgress, onError) {
  const s = connectSocket();
  s.emit('simulation:subscribe', simulationId);
  s.on('simulation:progress', onProgress);
  s.on('simulation:error', onError);

  return () => {
    s.emit('simulation:unsubscribe', simulationId);
    s.off('simulation:progress', onProgress);
    s.off('simulation:error', onError);
  };
}
