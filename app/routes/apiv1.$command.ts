import { ActionFunction, json } from "@remix-run/node";
import * as db from "~/store/db.server"
import { Commands } from "../common/apiv1.server";

export const action: ActionFunction = async ({ request, params }) => {
  switch (params.command as Commands) {
    case Commands.SetPeerServer:
      return setPeerServer(request);
    case Commands.SetPeerClient:
      return setPeerClient(request);
    case Commands.GetPeerClient:
      return getPeerClient(request);
    default:
      return json({ "error": "nothing" });
  }
};

const setPeerServer = async (request: Request) => {
  const data = await request.json();
  return json({ sid: db.setPeerServer(data.desc) });
};

const setPeerClient = async (request: Request) => {
  const data = await request.json();
  db.setPeerClient(data.sid, data.desc);
  console.log("set peer client: sid ", data.sid)
  return json({});
};

const getPeerClient = async (request: Request) => {
  const data = await request.json();
  console.log("waiting to get peer client: sid ", data.sid);
  const desc = await db.listenPeerClient(data.sid);
  console.log("got peer client of sid: ", data.sid);
  return json({ desc })
};
