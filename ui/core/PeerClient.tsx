import { useClientConnection } from "./Connection";
import { Flex } from "antd";
import { MessageBox } from "./MessageBox";

type ClientPageProps = {
  sid: string;
}

export const PeerClient = (props: ClientPageProps) => {
  useClientConnection(props.sid);

  return (
    <Flex vertical justify="center" align="center" style={{ width: "100%", height: "100%" }}>
      <MessageBox />
    </Flex>
  )
};
