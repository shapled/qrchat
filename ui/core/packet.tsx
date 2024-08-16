import { nanoid } from "nanoid";

export type PacketType = "text" | "fileMeta" | "fileRequired";

export type PacketBase = {
  type: PacketType,
  sendTime: string,
}

export type PacketText = PacketBase & {
  data: string,
}

export type PacketFileMeta = PacketBase & {
  fileID: string,
  fileNo: number,
  filename: string,
  size: number,
}

export type PacketFileRequired = PacketBase & {
  fileID: string,
  fileNo: number,
}

export type Packet = PacketText | PacketFileMeta | PacketFileRequired;

export const makeTextPacket = (text: string): PacketText => {
  return {
    type: "text",
    sendTime: new Date().toISOString(),
    data: text,
  }
}

// channel id: unsigned short [0, 65535] 
const numberGenerator = () => {
  return Math.floor(Math.random() * 65535);
}

export const makeFilePacket = (file: File): PacketFileMeta => {
  return {
    type: "fileMeta",
    sendTime: new Date().toISOString(),
    fileID: nanoid(),
    fileNo: numberGenerator(),
    filename: file.name,
    size: file.size,
  }
}

export const makeFileRequiredPacket = (fileID: string, fileNo: number): Packet => {
  return {
    type: "fileRequired",
    sendTime: new Date().toISOString(),
    fileID,
    fileNo,
  }
}
