import { PeerClient } from "./core/PeerClient";
import { PeerServer } from "./core/PeerServer";

export default function App() {
  const sid = new URLSearchParams(window.location.search).get("sid");

  return (
    <div className="font-sans p-4">
      {sid ? <PeerClient sid={sid!} />  : <PeerServer />}
    </div>
  );
}
