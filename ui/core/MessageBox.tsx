import {
  ChatContainer, 
  MainContainer,
  Message as UIMessage,
  MessageInput as UIMessageInput,
  MessageList as UIMessageList,
} from "@chatscope/chat-ui-kit-react"
import { Button, Flex, Modal, Progress, Spin } from "antd"
import { makeFilePacket, makeFileRequiredPacket, makeTextPacket, Message, Packet, useStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { useRef } from "react";
import { CheckOutlined, DownloadOutlined, ExclamationCircleFilled, LoadingOutlined, QuestionOutlined } from "@ant-design/icons";
import { makeWriter } from "./stream";

const MessageTextItem = ({ message }: { message: Message }) => {
  return (
    <UIMessage model={{
      message: message.text,
      sentTime: message.sendTime,
      direction: message.direction,
      position: "single",
      type: "text",
    }} />
  )
}

type MessageFileItemProps = {
  message: Message,
  onDownload: () => void,
}

const MessageFileItem = ({ message, onDownload }: MessageFileItemProps) => {
  const downloadFile = useStore(useShallow(state => state.downloadFile));

  return (
    <UIMessage model={{
      sentTime: message.sendTime,
      direction: message.direction,
      position: "single",
      type: "custom",
    }}>
      <UIMessage.CustomContent>
        <Flex justify="start" align="center" style={{ width: "300px", height: "80px", background: "white", borderRadius: "4px", padding: "16px" }}>
          <Flex justify="center" align="center" style={{ width: "48px", height: "48px", background: "#e3e3e3", borderRadius: "4px" }}>
            <QuestionOutlined />
          </Flex>
          <Flex vertical justify="space-between" style={{ height: "48px", marginLeft: "8px" }}>
            <div>{message.fileObj?.filename}</div>
            <div>{message.fileObj?.size}B</div>
          </Flex>
          <div style={{ flexGrow: 1 }} />
          <Flex justify="center" align="center">
            {message.fileObj?.status === "pending" 
              ? <Button shape="circle" onClick={() => {
                downloadFile(message.fileID!, makeWriter(message.fileObj!.filename, message.fileObj!.size));
                onDownload();
              }} icon={<DownloadOutlined />} />
              : message.fileObj?.status === "downloading" 
                ? <Progress type="circle" percent={message.fileObj?.received * 100 / message.fileObj?.size} />
                : message.fileObj?.status === "done"
                  ? <Button disabled shape="circle" icon={<CheckOutlined />} />
                  : <></>}
          </Flex>
        </Flex>
      </UIMessage.CustomContent>
    </UIMessage>
  )
}

export const MessageBox = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [send, status, messages] = useStore(
    useShallow((state) => [state.send, state.status, state.messages]));

  const connected = status === "connected";
  const connecting = status !== "connected" && status !== "closed";

  console.log("status: ", status)

  const showConfirm = (file: File, ok: () => void) => {
    Modal.confirm({
      title: 'Do you want to send this file?',
      icon: <ExclamationCircleFilled />,
      content: file.name,
      onOk() { ok() },
      onCancel() {},
    });
  };

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
                  {messages.map((message, i) =>  {
                    switch (message.type) {
                      case "text":
                        return <MessageTextItem key={i} message={message} />
                      case "file":
                        return (
                          <UIMessageList.Content>
                            <MessageFileItem 
                              key={i}
                              message={message} 
                              onDownload={() => {
                                send(makeFileRequiredPacket(message.fileID!));
                              }}
                            />
                          </UIMessageList.Content>
                        )
                      default:
                        return <></>
                    }
                  })}
                </UIMessageList>
                <UIMessageInput
                  onAttachClick={() => {
                    fileInputRef.current?.click();
                  }}
                  attachDisabled={!connected}
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
      <>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={() => {
            const files = fileInputRef.current?.files;
            if (files && files.length) {
              const file = files[0];
              showConfirm(file, () => {
                console.log("send file: ", file);
                send(makeFilePacket(file), file);
              })
            }
          }}
        />
      </>
    </div>
  )
}
