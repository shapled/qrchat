import { create } from "zustand";

export type ConnectionStatus = "waiting" | "shaking" | "connected" | "closed";

export type PacketType = "text" | "image" | "video" | "fileMeta" | "fileChunk" | "fileRequired";

export type Packet = {
  type: PacketType,
  sendTime: string,
  fileID: string,
  filename: string,
  filepath: string,
  data: string,
  size: number,
}

export const makeTextPacket = (text: string): Packet => {
  return {
    type: "text",
    sendTime: new Date().toISOString(),
    fileID: "",
    filename: "",
    filepath: "",
    data: text,
    size: text.length,
  }
}

export type MessageType = "text" | "image" | "video" | "file";

export type Message = {
  direction: "incoming" | "outgoing",
  sendTime: string,
  type: MessageType,
  text: string,
  fileID: string,
}

export type SmallFileObj = {
  fileID: string,
  filename: string,
  data: string,
}

export type LargeFileObj = {
  fileID: string,
  filename: string,
  filepath: string,
  status: "pending" | "downloading" | "done",
  size: number,
}

export type FileObj = { type: "small" | "large" }
  & (SmallFileObj | LargeFileObj);

export type ChatState = {
  roomID?: string;
  status: ConnectionStatus;
  messages: Message[];
  files: { [key: string]: FileObj };
  errors: string[];
  send: (packet: Packet) => void;
  recv: (packet: Packet) => void;
  setStatus: (status: ConnectionStatus) => void;
  setRoomID: (roomID: string) => void;
  addError: (error: string) => void;
  removeError: (index: number) => void;
}

export const useStore = create<ChatState>((set) => ({
  status: "waiting",
  messages: [],
  files: {},
  errors: [],
  send: (packet: Packet) => {
    console.log("send", packet);
    switch (packet.type) {
      case "text":
        set((state) => ({
          ...state,
          messages: [
            ...state.messages, 
            { direction: "outgoing", sendTime: packet.sendTime, type: "text", text: packet.data, fileID: "" },
          ]
        }))
        break;
      default:
        console.log("not implemented");
    }
  },
  recv: (packet: Packet) => {
    console.log("recv", packet);
    switch (packet.type) {
      case "text":
        set((state) => ({
          ...state,
          messages: [
            ...state.messages, 
            { direction: "incoming", sendTime: packet.sendTime, type: "text", text: packet.data, fileID: "" },
          ]
        }))
        break;
      default:
        console.log("not implemented");
    }
  },
  setStatus: (status: ConnectionStatus) => {
    const values = ["waiting", "shaking", "connected", "closed"]
    set((state) => {
      const oldIdx = values.indexOf(state.status);
      const newIdx = values.indexOf(status);
      return (oldIdx < newIdx) 
        ? { ...state, status: status }
        : state;
    });
  },
  setRoomID: (roomID: string) => {
    set((state) => ({ ...state, roomID }));
  },
  addError: (error: string) => {
    set((state) => ({ ...state, errors: [...state.errors, error] }));
  },
  removeError: (index: number) => {
    set((state) => ({ ...state, errors: state.errors.filter((_, i) => i !== index) }));
  },
}))
