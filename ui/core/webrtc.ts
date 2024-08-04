import { io } from "socket.io-client";

export const rtcPeerConfig = {
  iceServers: [
    // { urls: "stun.l.google.com:19302" },
    { urls: "stun:stun.miwifi.com" },
  ]
};

const site = process.env.NODE_ENV === 'production' ? "/" : "http://127.0.0.1:8000";
export const makeSocket = () => io(site, { path: "/apiv1/stream" });
