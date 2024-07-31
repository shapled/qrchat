import { createId } from '@paralleldrive/cuid2';
import { EventEmitter } from 'events';
import { Description } from '~/common/apiv1';

type Mailbox = {
  serverInit?: Description,
  clientAnswer?: Description,
  serverIceCandidate: RTCIceCandidate[],
  clientIceCandidate: RTCIceCandidate[],
  done: boolean,
}

type MailboxEvent = 'serverInit' | 'clientAnswer' | 'serverIceCandidate' | 'clientIceCandidate' | 'done';

type PeerInfo = {
  clientID?: string,
  mailbox: Mailbox,
  emitter: EventEmitter,
};

const connections: { [key: string]: PeerInfo } = {}

const clearMailboxEvent = (mailbox: Mailbox, event: MailboxEvent) => {
  switch (event) {
    case 'serverInit':
      delete mailbox.serverInit;
      break;
    case 'clientAnswer':
      delete mailbox.clientAnswer;
      break;
    case 'serverIceCandidate':
      mailbox.serverIceCandidate = [];
      break;
    case 'clientIceCandidate':
      mailbox.clientIceCandidate= [];
      break;
    case 'done':
      mailbox.done = false;
      break;
    default:
      throw new Error('Invalid event');
  }
}

const wakeEvent = (emitter: EventEmitter, event: MailboxEvent) => emitter.emit(event);

export const contains = (sid: string): boolean => !!connections[sid];

export const emitServerInit = (description: Description) => {
  const sid = createId()
  const emitter = new EventEmitter();
  const peerInfo: PeerInfo = {
    mailbox: {
      serverInit: description,
      clientAnswer: undefined,
      serverIceCandidate: [],
      clientIceCandidate: [],
      done: false,
    },
    emitter,
  }
  connections[sid] = peerInfo
  wakeEvent(emitter, 'serverInit')
  return sid
}

export const emitClientInit = (sid: string) => {
  const info = connections[sid];
  if (info && !info.clientID) {
    info.clientID = createId();
    return info.clientID;
  }
}

export const emitClientAnswer = (sid: string, cid: string, description: Description) => {
  const info = connections[sid];
  if (info && info.clientID === cid) {
    info.mailbox.clientAnswer = description;
    wakeEvent(info.emitter, 'clientAnswer');
  }
}

export const emitServerIceCandidate = (sid: string, candidate: RTCIceCandidate) => {
  const info = connections[sid];
  if (info) {
    info.mailbox.serverIceCandidate.push(candidate);
    wakeEvent(info.emitter, 'serverIceCandidate');
  }
}

export const emitClientIceCandidate = (sid: string, cid: string, candidate: RTCIceCandidate) => {
  const info = connections[sid];
  if (info && info.clientID === cid) {
    info.mailbox.clientIceCandidate.push(candidate);
    wakeEvent(info.emitter, 'clientIceCandidate');
  }
}

export const emitDone = (sid: string, cid: string) => {
  const info = connections[sid];
  if (info && info.clientID === cid) {
    info.mailbox.done = true;
    wakeEvent(info.emitter, 'done');
  }
}

const longPollingWithTimeout = async (emitter: EventEmitter, mailbox: Mailbox, event: MailboxEvent, timeout: number = 30000) => {
  // 先检查 info 中有没有 event
  const message = mailbox[event];
  if (message && (!Array.isArray(message) || message.length > 0)) {
    clearMailboxEvent(mailbox, event);
    return message;
  }

  // 如果没有就等待 emitter 的 event 事件
  return await Promise.race([
    new Promise((resolve) => {
      const consumeEvent = () => {
        const message = mailbox[event];
        if (message && (!Array.isArray(message) || message.length > 0)) {
          clearMailboxEvent(mailbox, event);
          return resolve(message)
        }
        emitter.once(event, consumeEvent)
      }
      emitter.once(event, consumeEvent);
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout exceeded'));
      }, timeout);
    }),
  ]);
};

export const onServerInit = async (sid: string, cid: string) => {
  const info = connections[sid];
  if (info && info.clientID === cid) {
    return await longPollingWithTimeout(info.emitter, info.mailbox, 'serverInit', 60000);
  }
  throw new Error('Invalid sid or cid');
}

export const onClientAnswer = async (sid: string) => {
  const info = connections[sid];
  if (info) {
    return await longPollingWithTimeout(info.emitter, info.mailbox, 'clientAnswer', 60000);
  }
  throw new Error('Invalid sid');
}

export const onServerIceCandidate = async (sid: string, cid: string) => {
  const info = connections[sid];
  if (info && info.clientID === cid) {
    return await longPollingWithTimeout(info.emitter, info.mailbox, 'serverIceCandidate', 60000);
  }
  throw new Error('Invalid sid or cid');
}

export const onClientIceCandidate = async (sid: string) => {
  const info = connections[sid];
  if (info) {
    return await longPollingWithTimeout(info.emitter, info.mailbox, 'clientIceCandidate', 60000);
  }
  throw new Error('Invalid sid');
}

export const onDone = async (sid: string) => {
  const info = connections[sid];
  if (info) {
    await longPollingWithTimeout(info.emitter, info.mailbox, 'done', 60000);
    info.emitter.removeAllListeners();
    delete connections[sid];
    return;
  }
  throw new Error('Invalid sid');
}
