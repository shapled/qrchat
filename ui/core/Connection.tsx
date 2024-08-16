import { io, Socket } from "socket.io-client";
import streamSaver from "streamsaver";

const log = (...messages: any) => console.log(...messages);

export type ConnectionStatus = "waiting" | "shaking" | "connected" | "closed";

type ErrorFunc = (error: string) => void;
type RecvFunc = (data: string) => void;
type RoomIDReadyFunc = (roomID: string) => void;
type StatusChangedFunc = (status: ConnectionStatus) => void;
type FileRecvFunc = (fileID: string) => { onRecvData: (chunk: Uint8Array) => void, onClose: () => void };

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
  fileChannels: { [key: string]: RTCDataChannel } = {};
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

  static makeFileChannelConfig = (id: number) => ({
    id,
    ordered: true,
    negotiated: true,
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

  send(data: string) {
    this.mainChannel?.send(data);
  }

  async sendFile(fileID: string, fileNo: number, file: File) {
    try {
      const channel = this.pc.createDataChannel(`file-${fileID}`, Connection.makeFileChannelConfig(fileNo));
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
        channel.send(value);
      }
      channel.close();
      delete this.fileChannels[fileID];
    } catch(err) {
      console.log("err: ", err)
    }
  }

  async recvFile(fileID: string, fileNo: number, filename: string) {
    if (!window.WritableStream) {
      streamSaver.WritableStream = WritableStream as any;
      window.WritableStream = WritableStream as any;
    }
    
    try {
      const channel = this.pc.createDataChannel(`file-${fileID}`, Connection.makeFileChannelConfig(fileNo));
      const fileStream = streamSaver.createWriteStream(filename);
      const writer = fileStream.getWriter();
      let chain = Promise.resolve();
  
      channel.onmessage = (event) => {
        chain = chain.then(() => writer.write(event.data));
      }
    } catch(err) {
      console.log("err: ", err)
    }
  }

  initFileChannel(fileID: string, channel: RTCDataChannel) {
    const result = this.onFileRecv?.(fileID);

    if (result) {
      const { onRecvData, onClose } = result;
      this.fileChannels[fileID] = channel;

      channel.onopen = () => {
        log(`file ${fileID} channel opened`);
      }

      channel.onclose = () => {
        log(`file ${fileID} channel closed`);
        onClose();
      } 

      channel.onmessage = (event) => onRecvData(event.data as Uint8Array);
      return;
    }

    this.onError?.(`file ${fileID} channel not found`);
  }
}
