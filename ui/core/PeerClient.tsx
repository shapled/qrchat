import { Packet, useStore } from "./store";
import { useClientConnection } from "./Connection";
import { Alert, Flex, Space } from "antd";
import { MessageBox } from "./MessageBox";
import { useShallow } from "zustand/react/shallow";

type ClientPageProps = {
  sid: string;
}

export const PeerClient = (props: ClientPageProps) => {
  const [errors, removeError] = useStore(useShallow(state => [state.errors, state.removeError]));
  const conn = useClientConnection(props.sid);

  return (
    <Flex vertical justify="center" align="center" style={{ width: "100%", height: "100%" }}>
      <Space direction="vertical">
        {errors.map((msg, i) => <Alert key={i} message={msg} type="error" closable onClose={() => removeError(i)} />)}
      </Space>

      <MessageBox send={(packet: Packet) => {
        conn.send(packet);
      } } />
    </Flex>
  )
};
