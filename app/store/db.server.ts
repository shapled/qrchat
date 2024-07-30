import { createId } from '@paralleldrive/cuid2';
import { EventEmitter } from 'events';
import { ClientMessage, Description, makeClientInitRemoteDescriptionMessage, makeServerInitRemoteDescriptionMessage, ServerMessage } from '~/common/apiv1.server';

type PeerInfo = {
  clientID?: string,
  serverMessages: ServerMessage[],
  clientMessages: ClientMessage[],
  emitter: EventEmitter,
};

const connections: { [key: string]: PeerInfo } = {}

export const searchPeerServerID = (sid: string): Description | undefined => {
  return connections[sid]?.server
}

const wakeServerRequest = (emitter: EventEmitter) => emitter.emit('server');
const wakeClientRequest = (emitter: EventEmitter) => emitter.emit('client');

export const setPeerServer = (description: Description) => {
  const sid = createId()
  const emitter = new EventEmitter();
  const peerInfo: PeerInfo = { serverMessages: [], clientMessages: [], emitter }
  peerInfo.clientMessages.push(makeClientInitRemoteDescriptionMessage(description));
  connections[sid] = peerInfo
  wakeClientRequest(emitter)
  return sid
}

export const setPeerClient = (sid: string, description: Description) => {
  const peerInfo = connections[sid];
  if (peerInfo && !peerInfo.clientID) {
    peerInfo.clientID = createId();
    peerInfo.serverMessages.push(makeServerInitRemoteDescriptionMessage(description));
    wakeServerRequest(peerInfo.emitter);
  }
}

export const serverWaitForClientConnection = async () => {
  while (true) {
    const sid = Object.keys(connections).find(sid => !connections[sid].clientID);
    if (sid) {
      return sid;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export const listenPeerClient = async (sid: string) => {
  const peerInfo = connections[sid];
  if (!peerInfo) { return; }
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => {
      peerInfo.emiter.removeAllListeners();
      reject();
    }, 60000);
    peerInfo.emiter.on('peer-client', (description: Description) => {
      clearTimeout(handle);
      peerInfo.emiter.removeAllListeners();
      delete connections[sid];
      resolve(description);
    });
  });
}
