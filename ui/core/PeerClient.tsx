import { Connection, ConnectionStatus } from "./Connection";
import { App, Flex } from "antd";
import { MessageBox } from "./MessageBox";
import { useEffect, useState } from "react";
import { onFileRecv, onPacketRecv } from "./message";
import { Packet } from "./packet";

type ClientPageProps = {
  sid: string;
}

export const PeerClient = (props: ClientPageProps) => {
  const { notification } = App.useApp();
  const [status, setStatus] = useState<ConnectionStatus>("waiting");
  const [connection, setConnectoin] = useState<Connection | undefined>();

  useEffect(() => {
    const conn = new Connection({ onFileRecv });
    setConnectoin(conn);

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

    conn.initClientSocket(props.sid);

    return () => conn.close();
  }, [props.sid])

  return (
    <Flex vertical justify="center" align="center" style={{ width: "100%", height: "100%" }}>
      <MessageBox
        status={status}
        send={(pkt: Packet) => connection?.send(JSON.stringify(pkt))}
      />
    </Flex>
  )
};
