export type Description = {
  sdp: string;
  type: string;
};

export enum Commands {
  emitServerInit = "emit-server-init",
  emitClientInit = "emit-client-init",
  emitClientAnswer = "emit-client-answer",
  emitDone = "emit-done",
  awaitServerInit = "await-server-init",
  awaitClientAnswer = "await-client-answer",
  emitServerIceCandidate = "emit-server-ice-candidate",
  emitClientIceCandidate = "emit-client-ice-candidate",
  awaitServerIceCandidate = "await-server-ice-candidate",
  awaitClientIceCandidate = "await-client-ice-candidate",
  awaitDone = "await-done",
}

export const fetchResult = async (command: Commands, data: unknown) => {
  const resp = await fetch(`/apiv1/${command}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const result = await resp.json();
  if (result.error) throw new Error(result.error);
  return result;
};
