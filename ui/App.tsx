import { Flex, Typography } from "antd";
import { Header } from "./core/Header";
import { PeerClient } from "./core/PeerClient";
import { PeerServer } from "./core/PeerServer";

export default function App() {
  const sid = new URLSearchParams(window.location.search).get("sid");

  return (
    <div>
      <Header />
      <Flex vertical justify="center" align="center" style={{ marginTop: "64px" }}>
        {sid ? <PeerClient sid={sid!} />  : <PeerServer />}
      </Flex>
    </div>
  );
}
