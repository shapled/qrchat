import { Flex, App } from "antd";
import { MessageBox } from "./MessageBox";
import { Connection, ConnectionStatus } from "./Connection";
import { QRCodeBox } from "./QRCodeBox";
import { useEffect, useState } from "react";
import { onFileRecv, onPacketRecv } from "./message";
import { Packet } from "./packet";

export const PeerServer = () => {
  const { notification } = App.useApp();
  const [sid, setSid] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("waiting");
  const [connection, setConnectoin] = useState<Connection | undefined>();

  const showQR = status === "waiting" || status === "shaking";

  useEffect(() => {
    const conn = new Connection({ onFileRecv });
    setConnectoin(conn);

    conn.onRoomIDReady = (roomID: string) => {
      setSid(roomID)
    }

    conn.onStatusChanged = (status: ConnectionStatus) => {
      setStatus(status);
    }
    
    conn.onError = (message: string) => {
      notification.error({
        message: "Error",
        description: message,
        closable: true,
      });
    }
  
    conn.onRecv = (data: string) => {
      onPacketRecv(conn, JSON.parse(data) as Packet);
    }

    conn.initServerSocket();
  }, [])

  return (
    <Flex vertical align="center" style={{ width: "100%", height: "100%" }}>
      {/* QR code or Message Box */}
      {showQR ? (
        <div style={{ marginTop: "64px" }}>
          <QRCodeBox status={status} sid={sid} />
        </div>
      ) : (
        <div style={{ flexGrow: 1, width: "100%" }}>
          <MessageBox
            status={status}
            send={(pkt: Packet) => connection?.send(JSON.stringify(pkt))}
          />
        </div>
      )}
    </Flex>
  )
};
