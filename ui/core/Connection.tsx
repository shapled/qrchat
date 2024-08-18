import { io, Socket } from "socket.io-client";
import { makeIceCandidate } from "./packet";
import { Semaphore } from "./semaphore";

const chunkSize = 16384;
const log = (...messages: any) => {
  process.env.NODE_ENV === 'production' || console.log(...messages);
}

export type ConnectionStatus = "waiting" | "shaking" | "connected" | "closed";

type ErrorFunc = (error: string) => void;
type RecvFunc = (data: string) => void;
type RoomIDReadyFunc = (roomID: string) => void;
type StatusChangedFunc = (status: ConnectionStatus) => void;
type FileRecvFunc = (fileID: string) => { onRecvData: (chunk: ArrayBuffer) => void, onClose: () => void };

export type ConnectionOptions = {
  onError?: ErrorFunc,
  onRecv?: RecvFunc,
  onRoomIDReady?: RoomIDReadyFunc,
  onStatusChanged?: StatusChangedFunc,
  onFileRecv?: FileRecvFunc,
}

export class Connection {
  onError?: ErrorFunc;
  onRecv?: RecvFunc;
  onRoomIDReady?: RoomIDReadyFunc;
  onStatusChanged?: StatusChangedFunc;
  onFileRecv?: FileRecvFunc;
  status: ConnectionStatus;
  mainChannel?: RTCDataChannel;
  readonly socket: Socket = Connection.makeSocket();
  readonly pc: RTCPeerConnection = new RTCPeerConnection(Connection.rtcPeerConfig);

  static readonly mainChannelName = "main";
  static readonly rtcPeerConfig = {
    iceServers: [
      // { urls: "stun.l.google.com:19302" },
      { urls: "stun:stun.miwifi.com" },
    ]
  };
  static readonly site = process.env.NODE_ENV === 'production' ? "/" : "http://127.0.0.1:8000";

  static  makeSocket() { 
    return io(Connection.site, { path: "/apiv1/stream" })
  }

  static makeFileChannelConfig = () => ({
    ordered: true,
    maxRetransmits: -1,
  });

  constructor(opt: ConnectionOptions) {
    this.onError = opt.onError;
    this.onRecv = opt.onRecv;
    this.onRoomIDReady = opt.onRoomIDReady;
    this.onStatusChanged = opt.onStatusChanged;
    this.onFileRecv = opt.onFileRecv;
    this.status = "waiting";
  }

  initServerSocket() {
    const socket = this.socket;
    const localConnection = this.pc;

    socket.io.on("open", () => { log("socket connected") })
    socket.io.on("close", () => { log("socket disconnected") })
    socket.io.on("error", (error) => { this.onError?.(error.message) })
    
    socket.on("custom-error", (message: string) => { this.onError?.(message) })

    localConnection.ondatachannel = (event) => {
      const channel = event.channel;

      if (channel.label === "main") {
        this.mainChannel = channel;

        channel.onopen = () => {
          this.setStatus("connected");
          log("channel opened");
        };
        
        channel.onclose = () => {
          this.setStatus("closed");
          log('channel closed');
        };
    
        channel.onmessage = (event) => this.onRecv?.(event.data);
        return;
      }

      if (channel.label.startsWith("file-")) {
        const fileID = channel.label.slice("file-".length);
        this.initFileChannel(fileID, channel);
        return;
      }

      this.onError?.(`unknown channel ${channel.label}`);
      return;
    }

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        const candidate = e.candidate;
        (async () => {
          while (true) {
            if (this.connected()) {
              log("emit ice-candidate via main data channel");
              this.mainChannel?.send(JSON.stringify(makeIceCandidate(candidate)))
              return;
            } else {
              if (await socket.emitWithAck("ice-candidate", JSON.stringify(candidate))) {
                log("emit ice-candidate via socket");
                return;
              }
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
        .catch(this.onError)
    })

    socket.emitWithAck("server-init")
      .then((roomID: string) => {
        log("ack info: ", roomID);
        this.setStatus("shaking");
        this.onRoomIDReady?.(roomID);
      })
      .catch(this.onError)
  }

  initClientSocket(roomID: string) {
    const socket = this.socket;
    const localConnection = this.pc;

    this.setStatus("shaking");

    const channel = this.mainChannel = localConnection.createDataChannel(Connection.mainChannelName);

    channel.onmessage = (event) => {
      this.onRecv?.(event.data)
    }

    socket.io.on("open", () => { log("socket connected") })
    socket.io.on("close", () => { log("socket disconnected") })
    socket.io.on("error", (error) => { this.onError?.(error.message) })

    socket.on("custom-error", (message: string) => { this.onError?.(message) })

    socket.on("server-answer", (desc: string) => {
      log("server answered");
      
      channel.onopen = () => {
        this.setStatus("connected");
        log("channel main opened");
      };
  
      channel.onclose = (event) => {
        this.setStatus("closed");
        log("channel main closed");
      };

      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
    })

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        const candidate = e.candidate;
        (async () => {
          while (true) {
            if (this.connected()) {
              log("emit ice-candidate via main data channel");
              this.mainChannel?.send(JSON.stringify(makeIceCandidate(candidate)))
              return;
            } else {
              if (await socket.emitWithAck("ice-candidate", JSON.stringify(candidate))) {
                log("emit ice-candidate via socket");
                return;
              }
            }
            log("emit ice-candidate failed, retry in 100ms");
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    }

    localConnection.ondatachannel = (event) => {
      const channel = event.channel;

      if (channel.label.startsWith("file-")) {
        const fileID = channel.label.slice("file-".length);
        this.initFileChannel(fileID, channel);
        return;
      }

      this.onError?.(`unknown channel ${channel.label}`);
      return;
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
      .catch(this.onError)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.onStatusChanged?.(status);
  }

  close() {
    if (this.socket.connected) {
      this.socket.close();
    }
    this.pc.close();
  }

  connected() {
    return this.status === "connected";
  }

  send(data: string) {
    this.mainChannel?.send(data);
  }

  async sendFile(fileID: string, file: File) {
    const channel = this.pc.createDataChannel(`file-${fileID}`, Connection.makeFileChannelConfig());
    let sem = new Semaphore();

    channel.binaryType = 'arraybuffer';
    channel.onclose = (event) => {
      log(`file ${fileID} channel closed`);
    }
    channel.onmessage = (event) => {
      sem.release();
    }
    channel.onopen = async () => {
      log(`file ${fileID} channel opened, state: ${channel.readyState}`);
      const reader = file.stream().getReader();
      if (!channel) {
        this.onError?.(`file ${fileID} channel not found`);
        return;
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        for (let i = 0; i < value.length; i += chunkSize) {
          const chunk = value.slice(i, i + chunkSize);
          log(`length: ${value.length}, type ${typeof value}`);
          const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteLength + chunk.byteOffset);
          await sem.acquire();
          channel.send(arrayBuffer);
        }
      }
      channel.close();
    }
  }

  initFileChannel(fileID: string, channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    const result = this.onFileRecv?.(fileID);

    if (result) {
      const { onRecvData, onClose } = result;
      const answer = new ArrayBuffer(1);

      channel.onopen = () => {
        log(`file ${fileID} channel opened`);
      }

      channel.onclose = () => {
        log(`file ${fileID} channel closed`);
        onClose();
      }

      channel.onmessage = (event) => {
        const data = event.data as ArrayBuffer;
        log(`got data length: ${data.byteLength}`)
        onRecvData(data);
        channel.send(answer);
      };
      return;
    }

    this.onError?.(`file ${fileID} channel not found`);
  }
}
