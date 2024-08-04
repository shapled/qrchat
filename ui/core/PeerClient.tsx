import { useEffect, useState } from "react";
import { makeSocket, rtcPeerConfig } from "./webrtc";
import { ChatContainer, MainContainer, Message, MessageInput, MessageList, MessageModel } from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { Flex } from "antd";

type ClientPageProps = {
  sid: string;
}

export const PeerClient = (props: ClientPageProps) => {
  const [warning, setWarning] = useState("")
  const [channel, setChannel] = useState<RTCDataChannel | undefined>();
  const [messages, setMessages] = useState<MessageModel[]>([])
  const appendMessage = (message: MessageModel) => {
    setMessages(previousMessages => [...previousMessages, message])
  }

  useEffect(() => {
    const socket = makeSocket();
    const localConnection = new RTCPeerConnection(rtcPeerConfig);

    const sendChannel = localConnection.createDataChannel("sendChannel");

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

    socket.on("server-answer", (desc: string) => {
      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
        .then(() => {
          setChannel(sendChannel)
        })
    })

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

    localConnection
      .createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() => socket.emit("client-init", props.sid, JSON.stringify(localConnection.localDescription)))
      .catch(onError)

    return () => {
      socket.close();
      localConnection.close();
    }
  }, [props.sid]);

  return (
    <Flex vertical justify="center" align="center">
      <h1>QRChat</h1>
      {warning && <div>some errors: {warning}</div>}
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
  );
};
