import { nanoid } from "nanoid";

export type PacketType = "text" | "fileMeta" | "fileRequired" | "iceCandidate";

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

export type PacketIceCandidate = PacketBase & {
  candidate: string,
}

export type Packet = PacketText | PacketFileMeta | PacketFileRequired | PacketIceCandidate;

export const makeTextPacket = (text: string): PacketText => {
  return {
    type: "text",
    sendTime: new Date().toISOString(),
    data: text,
  }
}

export const makeFilePacket = (file: File): PacketFileMeta => {
  return {
    type: "fileMeta",
    sendTime: new Date().toISOString(),
    fileID: nanoid(),
    filename: file.name,
    size: file.size,
  }
}

export const makeFileRequiredPacket = (fileID: string): Packet => {
  return {
    type: "fileRequired",
    sendTime: new Date().toISOString(),
    fileID,
  }
}

export const makeIceCandidate = (candidate: RTCIceCandidate) => {
  return {
    type: "iceCandidate",
    sendTime: new Date().toISOString(),
    candidate,
  }
}
