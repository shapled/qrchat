import { create } from "zustand";
import { Packet, PacketFileMeta, PacketFileRequired, PacketText } from "./packet";
import { Connection } from "./connection";
import streamSaver from "streamsaver";

export type MessageType = "text" | "file";

export type MessageDirection = "incoming" | "outgoing";

export type MessageBase = {
  direction: MessageDirection,
  sendTime: string,
  type: MessageType,
}

export type MessageText = MessageBase & {
  text: string,
}

export type MessageFile = MessageBase & {
  fileID: string,
  fileNo: number,
}

export type Message = MessageText | MessageFile;

export type FileObjStatus = "none" | "pending" | "downloading" | "received";

export type FileObj = {
  fileID: string,
  fileNo: number,
  filename: string,
  received: number,
  size: number,
  status: FileObjStatus,
}

export const makeTextMessage = (direction: MessageDirection, packet: PacketText): MessageText => {
  return {
    direction,
    sendTime: packet.sendTime,
    type: "text",
    text: packet.data,
  }
}

export const makeFileMetaMessage = (direction: MessageDirection, packet: PacketFileMeta): [MessageFile, FileObj] => {
  return [{
    direction,
    sendTime: packet.sendTime,
    type: "file",
    fileID: packet.fileID,
    fileNo: packet.fileNo,
  }, {
    fileID: packet.fileID,
    fileNo: packet.fileNo,
    filename: packet.filename,
    received: 0,
    size: packet.size,
    status: "none",
  }]
}

type MessagesState = {
  messages: Message[],
  sentFiles: { [key: string]: File },
  fileObjs: { [key: string]: FileObj },
  appendMessage: (message: Message, opt?: { file?: File, fileObj: FileObj }) => void,
  removeSentFile: (fileID: string) => void,
  incReceivedFileSize: (fileID: string, size: number) => void,
  setFileStatus: (fileID: string, status: FileObjStatus) => void,
}

export const useMessages = create<MessagesState>((set, get) => ({
  messages: [],
  sentFiles: {},
  fileObjs: {},
  appendMessage: (message: Message, opt? : { file?: File, fileObj: FileObj }) => {
    switch (message.type) {
      case "text": {
        set((state) => ({ ...state, messages: [ ...state.messages, message ] }));
        break;
      }
      case "file": {
        const msg = message as MessageFile;
        set((state) => {
          switch (msg.direction) {
            case "incoming": {
              const fileObj = opt!.fileObj;
              fileObj.status = "pending";
              return {
                ...state,
                fileObjs: { ...state.fileObjs, [msg.fileID]: fileObj },
                messages: [ ...state.messages, msg ],
              }
            }
            case "outgoing":
              return {
                ...state,
                sentFiles: { ...state.sentFiles, [msg.fileID]: opt!.file! },
                fileObjs: { ...state.fileObjs, [msg.fileID]: opt!.fileObj },
                messages: [ ...state.messages, msg ],
              }
            default:
              console.log(`unknown direction: ${msg.direction}`);
              return state;
          }
        });
        break;
      }
      default:
        console.log(`unknown message type: ${message.type}`);
        break;
    }
  },
  removeSentFile: (fileID: string) => {
    set(state => {
      delete state.sentFiles[fileID];
      return { ...state, sentFiles: { ...state.sentFiles }, fileObjs: { ...state.fileObjs } };
    });
  },
  incReceivedFileSize: (fileID: string, size: number) => {
    set(state => {
      const receivedFileObjs = state.fileObjs;
      receivedFileObjs[fileID].size += size;
      return { ...state, receivedFileObjs };
    });
  },
  setFileStatus: (fileID: string, status: FileObjStatus) => {
    set(state => {
      const receivedFileObjs = state.fileObjs;
      receivedFileObjs[fileID].status = status;
      return { ...state, receivedFileObjs };
    });
  },
}))

export const onPacketRecv = (conn: Connection, packet: Packet) => {
  switch (packet.type) {
    case "text": {
      const pkt = packet as PacketText;
      useMessages.getState().appendMessage(makeTextMessage("incoming", pkt));
      break;
    }
    case "fileMeta": {
      const pkt = packet as PacketFileMeta;
      const [message, fileObj] = makeFileMetaMessage("incoming", pkt);
      useMessages.getState().appendMessage(message, { fileObj });
      break;
    }
    case "fileRequired": {
      const pkt = packet as PacketFileRequired;
      const file = useMessages.getState().sentFiles[pkt.fileID];
      if (file) {
        conn.sendFile(pkt.fileID, pkt.fileNo, file).then(() => {
          useMessages.getState().removeSentFile(pkt.fileID);
        });
      }
      break;
    }
    default:
      console.log(`unknown packet type: ${packet.type}`);
      break;
  }
}

export const onFileRecv = (fileID: string) => {
  if (!window.WritableStream) {
    streamSaver.WritableStream = WritableStream as any;
    window.WritableStream = WritableStream as any;
  }
  
  const filename = useMessages.getState().fileObjs[fileID]?.filename || fileID;
  const fileStream = streamSaver.createWriteStream(filename);
  const writer = fileStream.getWriter();

  return {
    onRecvData: (chunk: Uint8Array) => {
      writer.write(chunk);
      useMessages.getState().incReceivedFileSize(fileID, chunk.byteLength);
    },
    onClose: () => {
      writer.close();
      fileStream.close();
      useMessages.getState().setFileStatus(fileID, "received");
    },
  }
}
