import {
  ChatContainer, 
  MainContainer,
  Message as UIMessage,
  MessageInput as UIMessageInput,
  MessageList as UIMessageList,
} from "@chatscope/chat-ui-kit-react"
import { Button, Flex, Modal, Progress, Spin } from "antd"
import { useRef } from "react";
import { CheckOutlined, DownloadOutlined, ExclamationCircleFilled, QuestionOutlined } from "@ant-design/icons";
import { makeFileMetaMessage, makeTextMessage, MessageFile, MessageText, useMessages } from "./message";
import { ConnectionStatus } from "./connection";
import { makeFilePacket, makeFileRequiredPacket, makeTextPacket, Packet } from "./packet";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

const MessageTextItem = ({ message }: { message: MessageText }) => {
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
  message: MessageFile,
  onDownload: (filename: string) => void,
}

const MessageFileItem = ({ message, onDownload }: MessageFileItemProps) => {
  const fileObj = useMessages(state => state.fileObjs[message.fileID]);

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
            <div>{fileObj?.filename}</div>
            <div>{fileObj?.size}B</div>
          </Flex>
          <div style={{ flexGrow: 1 }} />
          <Flex justify="center" align="center">
            <div style={{ height: "32px", width: "32px" }}>
              {fileObj?.status === "pending" ? (
                <Button shape="circle" onClick={() => {
                  onDownload(fileObj?.filename);
                }} icon={<DownloadOutlined />} />
              ) : fileObj?.status === "downloading" ? (
                <Progress size={32} type="circle" percent={fileObj?.received * 100 / fileObj?.size} />
              ) : fileObj?.status === "received" ? (
                <Button disabled shape="circle" icon={<CheckOutlined />} />
              ) : <></>}
            </div>
          </Flex>
        </Flex>
      </UIMessage.CustomContent>
    </UIMessage>
  )
}

type MessageBoxProps = {
  status: ConnectionStatus;
  send: (packet: Packet) => void;
  recvFile: (fileID: string, fileNo: number, filename: string) => void;
}

export const MessageBox = (props: MessageBoxProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useMessages();

  const connected = props.status === "connected";
  const connecting = props.status !== "connected" && props.status !== "closed";

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
                  {store.messages.map((message, i) =>  {
                    switch (message.type) {
                      case "text":
                        return (
                          <UIMessageList.Content key={i}>
                            <MessageTextItem message={message as MessageText} />
                          </UIMessageList.Content>
                        )
                      case "file":
                        return (
                          <UIMessageList.Content key={i}>
                            <MessageFileItem 
                              message={message as MessageFile} 
                              onDownload={(filename: string) => {
                                const msg = message as MessageFile;
                                store.setFileStatus(msg.fileID, "downloading");
                                props.recvFile(msg.fileID, msg.fileNo, filename);
                                props.send(makeFileRequiredPacket(msg.fileID, msg.fileNo));
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
                    const pkt = makeTextPacket(text);
                    const msg = makeTextMessage("outgoing", pkt);
                    store.appendMessage(msg);
                    props.send(pkt);
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
                const pkt = makeFilePacket(file);
                const [msg, fileObj] = makeFileMetaMessage("outgoing", pkt);
                store.appendMessage(msg, { file, fileObj });
                props.send(pkt);
              })
            }
          }}
        />
      </>
    </div>
  )
}
