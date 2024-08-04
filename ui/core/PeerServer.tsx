import { useEffect, useState } from "react";
import { makeSocket, rtcPeerConfig } from "./webrtc";
import { Button, Flex, Input, QRCode, Space, Tooltip } from "antd";
import { CheckOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import { ChatContainer, MainContainer, Message, MessageInput, MessageList, MessageModel } from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

export const PeerServer = () => {
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
      };
  
      sendChannel.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as MessageModel
        message.direction = "incoming"
        appendMessage(message)
      }

      console.log("data channel is ready!");
      setChannel(sendChannel);
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
            if (localConnection.localDescription) {
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
      })
    
    return () => {
      socket.close();
      localConnection.close();
    }
  }, [])

  return (
    <Flex vertical justify="center" align="center">
      <h1>QRChat</h1>
      {warning && <div>{warning}</div>}
      {!channel && roomID && (
        <Space direction="vertical" align="center">
          <QRCode value={clientUrl} />
          <Space direction="horizontal">
            <Input placeholder="-" maxLength={120} value={clientUrl} />
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
        </Space>
      )}
      {channel && (
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
      )}
    </Flex>
  )
};
