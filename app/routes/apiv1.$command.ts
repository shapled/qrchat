import { ActionFunction, json } from "@remix-run/node";
import * as db from "~/store/db.server"
import { Commands } from "../common/apiv1";

export const action: ActionFunction = async ({ request, params }) => {
  const data = await request.json();
  try {
    switch (params.command as Commands) {
      case Commands.emitServerInit:
        return json({ sid: db.emitServerInit(data.desc) });
      case Commands.emitClientInit:
        return json({ cid: db.emitClientInit(data.sid) });
      case Commands.emitClientAnswer:
        db.emitClientAnswer(data.sid, data.cid, data.desc);
        return json({});
      case Commands.emitDone:
        db.emitDone(data.sid, data.cid);
        return json({});
      case Commands.emitServerIceCandidate:
        db.emitServerIceCandidate(data.sid, data.candidate);
        return json({});
      case Commands.emitClientIceCandidate:
        db.emitClientIceCandidate(data.sid, data.cid, data.candidate);
        return json({});
      case Commands.awaitServerInit:
        return json({ desc: await db.onServerInit(data.sid, data.cid) });
      case Commands.awaitClientAnswer:
        return json({ desc: await db.onClientAnswer(data.sid) });
      case Commands.awaitServerIceCandidate:
        return json({ candidates: await db.onServerIceCandidate(data.sid, data.cid) });
      case Commands.awaitClientIceCandidate:
        return json({ candidates: await db.onClientIceCandidate(data.sid) });
      case Commands.awaitDone:
        await db.onDone(data.sid);
        return json({});
      default:
        break;
    }
  } catch (e) {
    return json({ error: e });
  }
  throw new Response(null, {
    status: 404,
    statusText: "Not Found",
  });
};
