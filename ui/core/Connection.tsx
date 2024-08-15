import { useCallback, useEffect } from "react";
import { dataChannelConfig, makeSocket, rtcPeerConfig } from "./webrtc";
import { Packet, useStore } from "./store";
import { useShallow } from 'zustand/react/shallow'
import { App } from "antd";

const log = (...messages: any) => console.log(...messages);

export type ServerConnection = {
  send: (packet: Packet) => void,
  close: () => void,
}

export const useServerConnection = () => {
  const { notification } = App.useApp();
  const [setRoomID, setStatus, recv] = useStore(
    useShallow((state) => [state.setRoomID, state.setStatus, state.recv]));

  const addError = useCallback((error: string) => {
    notification.error({ message: "Error", description: error });
  }, [notification])

  useEffect(() => {
    const socket = makeSocket();
    const localConnection = new RTCPeerConnection(rtcPeerConfig);

    socket.io.on("open", () => { log("socket connected") })
    socket.io.on("close", () => { log("socket disconnected") })
    socket.io.on("error", (error) => { addError(error.message) })
    
    socket.on("custom-error", (message: string) => { addError(message) })

    localConnection.ondatachannel = (event) => {
      const sendChannel = event.channel;

      sendChannel.onopen = (event) => {
        setStatus("connected", (packet: Packet) => { sendChannel.send(JSON.stringify(packet)) });
        log("channel opened");
      };
      
      sendChannel.onclose = (event) => {
        setStatus("closed");
        log('channel closed');
      };
  
      sendChannel.onmessage = (event) => recv(JSON.parse(event.data as string) as Packet)
    }

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        log("emit ice-candidate")
        const data = JSON.stringify(e.candidate);
        (async () => {
          while (true) {
            if (await socket.emitWithAck("ice-candidate", data)) {
              return;
            }
            log("emit ice-candidate failed, retry in 100ms");
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    }

    socket.on("ice-candidate", (candidate) => {
      if (candidate) {
        (async () => {
          while (true) {
            if (localConnection.localDescription && localConnection.remoteDescription) {
              log("add ice-candidate")
              localConnection.addIceCandidate(JSON.parse(candidate) as RTCIceCandidate)
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    })

    socket.on("client-init", (desc: string) => {
      log("got client-init");
      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
        .then(() => {
          return localConnection.createAnswer();
        })
        .then(answer => localConnection.setLocalDescription(answer))
        .then(() => {
          log("sent server answer")
          socket.emit("server-answer", JSON.stringify(localConnection.localDescription))
        })
        .catch(addError)
    })

    socket.emitWithAck("server-init")
      .then((roomID: string) => {
        log("ack info: ", roomID);
        setRoomID(roomID);
        setStatus("shaking");
      })
    
    return () => {
      if (socket.connected) {
        socket.close();
      }
      localConnection.close();
    }
  }, [addError, setStatus, recv, setRoomID])
}

export type ClientConnection = {
  send: (packet: Packet) => void,
  close: () => void,
}

export const useClientConnection = (roomID: string) => {
  const { notification } = App.useApp();
  const [setStatus, recv] = useStore(useShallow((state) => [state.setStatus, state.recv]));

  const addError = useCallback((error: string) => {
    notification.error({ message: "Error", description: error });
  }, [notification])

  useEffect(() => {
    const socket = makeSocket();
    const localConnection = new RTCPeerConnection(rtcPeerConfig);

    const sendChannel = localConnection.createDataChannel("sendChannel", dataChannelConfig);

    sendChannel.onmessage = (event) => {
      recv(JSON.parse(event.data as string) as Packet)
    }

    socket.io.on("open", () => { log("socket connected") })
    socket.io.on("close", () => { log("socket disconnected") })
    socket.io.on("error", (error) => { addError(error.message) })

    socket.on("custom-error", (message: string) => { addError(message) })

    socket.on("server-answer", (desc: string) => {
      log("server answered");
      
      sendChannel.onopen = (event) => {
        setStatus("connected", (packet: Packet) => { sendChannel.send(JSON.stringify(packet)) })
        log("channel opened");
      };
  
      sendChannel.onclose = (event) => {
        setStatus("closed");
        log("channel closed");
      };

      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
    })

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        log("emit ice-candidate")
        const data = JSON.stringify(e.candidate);
        (async () => {
          while (true) {
            if (await socket.emitWithAck("ice-candidate", data)) {
              return;
            }
            console.log("emit ice-candidate failed, retry in 100ms");
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    }

    socket.on("ice-candidate", (candidate) => {
      if (candidate) {
        (async () => {
          while (true) {
            if (localConnection.localDescription && localConnection.remoteDescription) {
              log("add ice-candidate")
              localConnection.addIceCandidate(JSON.parse(candidate) as RTCIceCandidate)
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    })

    localConnection
      .createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() => socket.emit("client-init", roomID, JSON.stringify(localConnection.localDescription)))
      .catch(addError)

    return () => {
      if (socket.connected) {
        socket.close();
      }
      localConnection.close();
    }
  }, [setStatus, recv, roomID, addError]);
}
