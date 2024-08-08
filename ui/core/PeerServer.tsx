import { useEffect, useState } from "react";
import { makeSocket, rtcPeerConfig } from "./webrtc";
import { Button, Flex, Input, QRCode, Space, Tooltip, Statistic, Typography } from "antd";
import { CheckOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import { ChatContainer, MainContainer, Message, MessageInput, MessageList, MessageModel } from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

const { Countdown } = Statistic;

export const PeerServer = () => {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<"active" | "loading" | "expired" | "scanned">("loading")
  const [deadline, setDeadline] = useState<number | undefined>()
  const [roomID, setRoomID] = useState("")
  const [warning, setWarning] = useState("")
  const [copied, setCopied] = useState(false)
  const [channel, setChannel] = useState<RTCDataChannel | undefined>();
  const [messages, setMessages] = useState<MessageModel[]>([])

  const currentURL = new URL(window.location.href);
  const clientUrl = `${currentURL.origin}${currentURL.pathname}?sid=${roomID}`;

  const appendMessage = (message: MessageModel) => {
    setMessages(previousMessages => [...previousMessages, message])
  }

  useEffect(() => {
    const socket = makeSocket();
    const localConnection = new RTCPeerConnection(rtcPeerConfig);

    const onError = (message: string) => {
      socket.close()
      localConnection.close()
      console.log(`Got error: ${message}`)
      setWarning(`Got error: ${message}`);
    }

    socket.io.on("open", () => { console.log("socket connected") })
    socket.io.on("close", () => { console.log("socket disconnected") })
    socket.io.on("error", (error) => { onError(error.message) })
    
    socket.on("custom-error", (message: string) => { onError(message) })

    localConnection.ondatachannel = (event) => {
      const sendChannel = event.channel;

      sendChannel.onopen = (event) => {
        console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
      };
  
      sendChannel.onclose = (event) => {
        console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
        setConnected(false);
      };
  
      sendChannel.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as MessageModel
        message.direction = "incoming"
        appendMessage(message)
      }

      console.log("data channel is ready!");
      setChannel(sendChannel);
      setConnected(true);
    }

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        console.log("emit ice-candidate")
        const data = JSON.stringify(e.candidate);
        (async () => {
          while (true) {
            if (await socket.emitWithAck("ice-candidate", data)) {
              return;
            }
            console.log("emit ice-candidate failed, retry in 100ms");
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    }

    socket.on("ice-candidate", (candidate) => {
      if (candidate) {
        (async () => {
          while (true) {
            if (localConnection.localDescription && localConnection.remoteDescription) {
              console.log("add ice-candidate")
              localConnection.addIceCandidate(JSON.parse(candidate) as RTCIceCandidate)
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })()
      }
    })

    socket.on("client-init", (desc: string) => {
      console.log("got client-init");
      setStatus("scanned");
      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
        .then(() => {
          return localConnection.createAnswer();
        })
        .then(answer => localConnection.setLocalDescription(answer))
        .then(() => {
          console.log("sent server answer")
          socket.emit("server-answer", JSON.stringify(localConnection.localDescription))
        })
        .catch(onError)
    })

    socket.emitWithAck("server-init")
      .then((roomID: string) => {
        console.log("ack info: ", roomID)
        setRoomID(roomID)
        setStatus("active")
        setDeadline(Date.now() + 1000 * 60);
      })
    
    return () => {
      socket.close();
      localConnection.close();
    }
  }, [])

  return (
    <Flex vertical justify="center" align="center">
      {/* Warning Info */}
      {warning && <div>{warning}</div>}

      {/* QR code */}
      {!channel && roomID && (
        <Space direction="vertical" align="center">
          <Typography.Title>Scan this QR code to start a serverless chat.</Typography.Title>
          <QRCode size={200} value={clientUrl} status={status} onRefresh={status === "expired" ? (() => {
            window.location.reload();
          }) : undefined} />
          {status !== "expired" && (
            <Space direction="vertical" size="large">
              <Space direction="horizontal">
                <Input placeholder="-" value={clientUrl} />
                <Tooltip title={copied ? "copied" : "copy"}>
                  <Button 
                    size="small" 
                    shape="circle" 
                    icon={ copied ? <CheckOutlined /> : <CopyOutlined /> } 
                    onClick={() => {
                      navigator.clipboard.writeText(clientUrl).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                    disabled={copied}
                  />
                </Tooltip>
                <Tooltip title="open in new tab">
                  <Button
                    size="small"
                    shape="circle"
                    icon={<LinkOutlined />}
                    onClick={() => window.open(clientUrl, "_blank")}
                  />
                </Tooltip>
              </Space>
              <Typography.Paragraph>
                The QR code will expire in {
                  <Countdown 
                    style={{ display: "inline-block" }} 
                    value={deadline} 
                    format="ss" 
                    onFinish={() => { if (!channel) { setStatus("expired") }}}
                  />
                } seconds.
              </Typography.Paragraph>
            </Space>
          )}
        </Space>
            
      )}

      {/* Chating status && Box */}
      {channel && (
        <Space size="middle" direction="vertical">
          <Flex justify="center" align="center">
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
          <div style={{ position: "relative", maxWidth: "100%", width: "600px", height: "500px" }}>
            <MainContainer>
              <ChatContainer>
                <MessageList>
                  {messages.map((message, i) => (<Message key={i} model={message} />))}
                </MessageList>
                <MessageInput placeholder="Type message here" onSend={(_, text) => {
                  const message: MessageModel = {
                    direction: "outgoing",
                    position: "single",
                    message: text,
                  }
                  appendMessage(message)
                  channel.send(JSON.stringify(message))
                }} />
              </ChatContainer>
            </MainContainer>
          </div>
        </Space>
      )}
    </Flex>
  )
};
