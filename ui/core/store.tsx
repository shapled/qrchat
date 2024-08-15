import { nanoid } from "nanoid";
import { create } from "zustand";
import { makeReader } from "./stream";

export type ConnectionStatus = "waiting" | "shaking" | "connected" | "closed";

export type PacketType = "text" | "image" | "video" | "fileMeta" | "fileChunk" | "fileRequired";

export type PacketBase = {
  type: PacketType,
  sendTime: string,
}

export type PacketText = PacketBase & {
  data: string,
}

export type PacketFileMeta = PacketBase & {
  fileID: string,
  filename: string,
  size: number,
}

export type PacketFileRequired = PacketBase & {
  fileID: string,
}

export type PacketFileChunk = PacketBase & {
  fileID: string,
  data: Uint8Array,
  size: number,
}

export type Packet = PacketText | PacketFileMeta | PacketFileRequired | PacketFileChunk;

type PacketSender = (packet: Packet) => void;

export const makeTextPacket = (text: string): Packet => {
  return {
    type: "text",
    sendTime: new Date().toISOString(),
    data: text,
    size: text.length,
  }
}

export const makeFilePacket = (file: File): Packet => {
  return {
    type: "fileMeta",
    sendTime: new Date().toISOString(),
    fileID: nanoid(),
    filename: file.name,
    size: file.size,
  }
}

export const makeFileChunkPacket = (fileID: string, data: Uint8Array): Packet => {
  return {
    type: "fileChunk",
    sendTime: new Date().toISOString(),
    fileID: fileID,
    data: data,
    size: data.length,
  }
}

export const makeFileRequiredPacket = (fileID: string): Packet => {
  return {
    type: "fileRequired",
    sendTime: new Date().toISOString(),
    fileID,
  }
}

export type MessageType = "text" | "image" | "video" | "file";

export type Message = {
  direction: "incoming" | "outgoing",
  sendTime: string,
  type: MessageType,
  text?: string,
  fileID?: string,
  fileObj?: FileObj,
}

export type FileObjStatus = "none" | "pending" | "downloading" | "done";

export type FileObj = {
  fileID: string,
  filename: string,
  filepath?: string,
  received: number,
  size: number,
  status: FileObjStatus,
  writer?: WritableStreamDefaultWriter,
  writerPromsie?: Promise<void>,
}

export type ChatState = {
  roomID?: string;
  status: ConnectionStatus;
  messages: Message[];
  sendedFiles: { [key: string]: File };
  receivedFiles: { [key: string]: FileObj };
  sender?: PacketSender;
  recv: (packet: Packet) => void;
  send: (packet: Packet, file?: File) => void;
  setStatus: (status: ConnectionStatus, sender?: PacketSender) => void;
  setRoomID: (roomID: string) => void;
  downloadFile: (fileID: string, writer: WritableStreamDefaultWriter) => void,
}

export const useStore = create<ChatState>(
  (set, get) => ({
      status: "waiting",
      messages: [],
      sendedFiles: {},
      receivedFiles: {},
      recv: (packet: Packet) => {
        console.log("recv", packet);
        switch (packet.type) {
          case "text": {
            const pkt = packet as PacketText;
            set((state) => ({
              ...state,
              messages: [
                ...state.messages, 
                { direction: "incoming", sendTime: packet.sendTime, type: "text", text: pkt.data },
              ]
            }));
            break;
          }
          case "fileMeta": {
            const pkt = packet as PacketFileMeta;
            const fileObj: FileObj = {
              fileID: pkt.fileID, 
              filename: pkt.filename,
              status: "pending",
              received: 0, 
              size: pkt.size,
            };
            set((state) => ({
              ...state,
              receivedFiles: {
                ...state.receivedFiles, 
                [pkt.fileID]: fileObj,
              },
              messages: [
                ...state.messages, 
                { direction: "incoming", sendTime: packet.sendTime, type: "file", fileID: pkt.fileID, fileObj },
              ]
            }));
            break;
          }
          case "fileRequired": {
            const pkt = packet as PacketFileRequired;
            set(state => {
              const file = state.sendedFiles[pkt.fileID];
              if (file) {
                (async () => {
                  const reader = makeReader(file);
                  const sender = state.sender;
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      console.log("send file done")
                      break;
                    }
                    sender!(makeFileChunkPacket(pkt.fileID, value!));
                    console.log(`send file chunk, size ${value?.length}`);
                  }
                })()
              }
              return state;
            })
            break;
          }
          case "fileChunk": {
            const pkt = packet as PacketFileChunk;
            const fileObj = get().receivedFiles[pkt.fileID];
            if (!fileObj) {
              console.log("fileID ", pkt.fileID, " not found");
              return;
            }
            fileObj.writerPromsie = fileObj.writerPromsie!.then(() => {
              return fileObj.writer?.write(pkt.data).then(() => {
                console.log(`writed ${pkt.size} bytes to ${pkt.fileID}`);
                fileObj.received += pkt.size;
                if (fileObj.received === fileObj.size) {
                  console.log(`recv ${pkt.fileID} done.`);
                  fileObj.status = "done";
                  fileObj.writer?.close();
                }
                set(state => ({
                  ...state,
                  receivedFiles: {
                    ...state.receivedFiles,
                    [pkt.fileID]: fileObj,
                  }
                }));
                return Promise.resolve();
              })
            });
            set(state => ({
              ...state,
              receivedFiles: {
                ...state.receivedFiles,
                [pkt.fileID]: fileObj,
              }
            }));
            break;
          }
          default:
            console.log(`recv ${packet.type} not implemented`);
        }
      },
      send: (packet: Packet, file?: File) => {
        switch (packet.type) {
          case "text": {
            const pkt = packet as PacketText;
            set(state => ({
              ...state,
              messages: [
                ...state.messages, 
                { direction: "outgoing", sendTime: packet.sendTime, type: "text", text: pkt.data },
              ],
            }));
            break;
          }
          case "fileMeta": {
            const pkt = packet as PacketFileMeta;
            const fileObj: FileObj = {
              fileID: pkt.fileID, 
              filename: pkt.filename,
              status: "none",
              received: 0, 
              size: pkt.size,
            };
            set(state => ({
              ...state,
              sendedFiles: { ...state.sendedFiles, [pkt.fileID]: file! },
              messages: [
                ...state.messages, 
                { direction: "outgoing", sendTime: packet.sendTime, type: "file", fileID: pkt.fileID, fileObj },
              ]
            }));
            break;
          }
          case "fileRequired":
            break;
          default:
            console.log(`send ${packet.type} not implemented`);
            return;
          }
        get().sender!(packet);
      },
      setStatus: (status: ConnectionStatus, sender?: PacketSender) => {
        const values = ["waiting", "shaking", "connected", "closed"]
        set((state) => {
          const oldIdx = values.indexOf(state.status);
          const newIdx = values.indexOf(status);
          if (oldIdx >= newIdx) {
            return state
          }
          const nextSender = sender || state.sender;
          return { ...state, status, sender: nextSender };
        });
      },
      setRoomID: (roomID: string) => {
        set((state) => ({ ...state, roomID }));
      },
      downloadFile: (fileID: string, writer: WritableStreamDefaultWriter) => {
        set((state) => {
          const fileObj = state.receivedFiles[fileID];
          if (!fileObj) {
            return state;
          }
          fileObj.status = "downloading";
          fileObj.writer = writer;
          fileObj.writerPromsie = Promise.resolve();
          return {
            ...state,
            receivedFiles: {
              ...state.receivedFiles,
              [fileID]: fileObj,
            }
          }
        })
      },
  }),
);
