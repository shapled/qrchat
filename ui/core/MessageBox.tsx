import {
  ChatContainer, 
  MainContainer,
  Message as UIMessage,
  MessageInput as UIMessageInput,
  MessageList as UIMessageList,
  MessageType as UIMessageType,
} from "@chatscope/chat-ui-kit-react"
import { Flex, Space, Spin } from "antd"
import { makeTextPacket, Message, Packet, useStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

type MessageBoxProps = {
  send: (packet: Packet) => void,
}

export const MessageBox = (props: MessageBoxProps) => {
  const [sendToStore, status, messages] = useStore(useShallow((state) => [state.send, state.status, state.messages]));

  const connected = status === "connected";
  const connecting = status !== "connected" && status !== "closed";

  console.log("status: ", status)

  const send = (packet: Packet) => {
    sendToStore(packet);
    props.send(packet);
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {!connecting ? (
        <Flex vertical justify="strech" align="stretch" style={{ width: "100%", height: "100%" }}>
          <Flex justify="start" align="center" style={{ height: "48px", padding: "0 8px" }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: connected ? 'green' : 'gray',
                marginRight: '8px',
              }}
            />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </Flex>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <MainContainer>
              <ChatContainer>
                <UIMessageList>
                  {messages.map((message, i) => (
                    <UIMessage 
                      key={i}
                      model={{
                        message: message.text,
                        sentTime: message.sendTime,
                        direction: message.direction,
                        position: "single",
                        type: "text",
                      }}
                    />
                  ))}
                </UIMessageList>
                <UIMessageInput
                  sendDisabled={!connected}
                  placeholder="Type message here" 
                  onSend={(_, text) => {
                    send(makeTextPacket(text));
                  }}
                />
              </ChatContainer>
            </MainContainer>
          </div>
        </Flex>
      ) : (
        <Flex justify="center" align="center" style={{ width: "100%", height: "100%" }}>
          <Spin size="large" />
        </Flex>
      )}
    </div>
  )
}
