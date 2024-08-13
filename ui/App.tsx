import { Flex } from "antd";
import { Header } from "./core/Header";
import { PeerClient } from "./core/PeerClient";
import { PeerServer } from "./core/PeerServer";
import styled from "styled-components";

const Container = styled(Flex)`
  height: 100vh;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
`

const Content = styled(Flex)`
  padding: 0 8px 16px 8px;
  flex-grow: 1;
`

export default function App() {
  const sid = new URLSearchParams(window.location.search).get("sid");

  return (
    <Container vertical>
      <Header />
      <Content vertical justify="center" align="center">
        {sid ? <PeerClient sid={sid!} />  : <PeerServer />}
      </Content>
    </Container>
  );
}
