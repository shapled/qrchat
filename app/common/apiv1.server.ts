export type Description = {
  sdp: string;
  type: string;
};

export enum Commands {
  SetPeerServer = "set-peer-server",
  SetPeerClient = "set-peer-client",
  GetPeerClient = "get-peer-client",
}

// SM = Server Mailbox, CM = Client Mailbox
export enum ServerMessageType {
  InitRemoteDescription,
}

export enum ClientMessageType {
  InitRemoteDescription,
}

export type ServerMessage = {
  type: ServerMessageType,
  data: unknown,
};

export type ClientMessage = {
  type: ClientMessageType,
  data: unknown,
};

export const makeServerInitRemoteDescriptionMessage = (desc: Description): ServerMessage => {
  return {
    type: ServerMessageType.InitRemoteDescription,
    data: desc,
  }
}

export const makeClientInitRemoteDescriptionMessage = (desc: Description): ClientMessage => {
  return {
    type: ClientMessageType.InitRemoteDescription,
    data: desc,
  }
}

