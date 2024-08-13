import { Flex, Alert, Space } from "antd";
import { MessageBox } from "./MessageBox";
import { useServerConnection } from "./Connection";
import { Packet, useStore } from "./store";
import { QRCodeBox } from "./QRCodeBox";
import { useShallow } from "zustand/react/shallow";

export const PeerServer = () => {
  const [status, errors, removeError] = useStore(
    useShallow(state => [state.status, state.errors, state.removeError]))
  const conn = useServerConnection();

  const showQR = status === "waiting" || status === "shaking";

  return (
    <Flex vertical align="center" style={{ width: "100%", height: "100%" }}>
      <Flex vertical justify="center" align="center" style={{ width: "100%", height: "100%" }}>
        <Space direction="vertical">
          {errors.map((msg, i) => <Alert key={i} message={msg} type="error" closable onClose={() => removeError(i)} />)}
        </Space>
      </Flex>
      
      {/* QR code or Message Box */}
      {showQR ? (
        <div style={{ marginTop: "64px" }}>
          <QRCodeBox />
        </div>
      ) : (
        <div style={{ flexGrow: 1, width: "100%" }}>
          <MessageBox send={(packet: Packet) => {
            conn.send(packet);
          }} />
        </div>
      )}
    </Flex>
  )
};
