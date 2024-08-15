import { Flex } from "antd";
import { MessageBox } from "./MessageBox";
import { useServerConnection } from "./Connection";
import { useStore } from "./store";
import { QRCodeBox } from "./QRCodeBox";
import { useShallow } from "zustand/react/shallow";

export const PeerServer = () => {
  useServerConnection();
  const status = useStore(useShallow(state => state.status))

  const showQR = status === "waiting" || status === "shaking";

  return (
    <Flex vertical align="center" style={{ width: "100%", height: "100%" }}>
      {/* QR code or Message Box */}
      {showQR ? (
        <div style={{ marginTop: "64px" }}>
          <QRCodeBox />
        </div>
      ) : (
        <div style={{ flexGrow: 1, width: "100%" }}>
          <MessageBox />
        </div>
      )}
    </Flex>
  )
};
