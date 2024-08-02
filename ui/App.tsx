import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export type Description = {
  sdp: string;
  type: string;
};

type ChatMessage = {
  direction: "send" | "receive";
  message: string;
}

const configuration = {
  iceServers: [{
    urls: "stun:stun.miwifi.com",
  }]
};

const ServerPage = () => {
  const [sid, setSid] = useState("")
  const [warning, setWarning] = useState("")
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('');

  const appendMessage = (direction: "send" | "receive", message: string) => {
    setMessages(messages => [{ message, direction }, ...messages])
  }

  useEffect(() => {
    const socket = io("http://127.0.0.1:8000", { path: "/apiv1/stream", transports: ['polling'] });
    const localConnection = new RTCPeerConnection(configuration);

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
        appendMessage("receive", event.data as string);
      }

      console.log("data channel is ready!");

      setSendMessage(() => ((message: string) => {
        if (message) {
          setInputValue("");
          appendMessage("send", message);
          sendChannel.send(message);
        }
      }))
    }

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        console.log("emit ice-candidate")
        socket.emit("ice-candidate", JSON.stringify(e.candidate))
      }
    }

    socket.on("ice-candidate", (candidate) => {
      if (candidate) {
        console.log("add ice-candidate")
        localConnection.addIceCandidate(JSON.parse(candidate) as RTCIceCandidate)
      }
    })

    socket.on("client-init", (desc: string) => {
      console.log("got client-init");
      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
        .then(() => localConnection.createAnswer())
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
        setSid(roomID)
      })
    
    return () => {
      socket.close();
      localConnection.close();
    }
  }, [])

  return (
    <div>
      <h1>Server Page</h1>
      {warning && <div>{warning}</div>}
      {messages.map((message, index) => (
        <div key={index}>
          <div>{message.direction === "send" ? "我" : "对方"}</div>
          <div>{message.message}</div>
        </div>
      ))}
      {!sendMessage && sid && (<div>访问 <a href={`/?sid=${sid}`}>{`/?sid=${sid}`}</a></div>)}
      {sendMessage && (
        <div>
          <input type="text" value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
          <button onClick={() => {
            sendMessage(inputValue)
          }}>Send</button>
        </div>
      )}
    </div>
  )
};

type ClientPageProps = {
  sid: string;
}

const ClientPage = (props: ClientPageProps) => {
  const [warning, setWarning] = useState("")
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('');

  const appendMessage = (direction: "send" | "receive", message: string) => {
    setMessages(messages => [{ message, direction }, ...messages])
  }

  useEffect(() => {
    const socket = io("http://127.0.0.1:8000", { path: "/apiv1/stream", transports: ['polling'] });
    const localConnection = new RTCPeerConnection(configuration);

    const sendChannel = localConnection.createDataChannel("sendChannel");

    sendChannel.onopen = (event) => {
      console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
    };

    sendChannel.onclose = (event) => {
      console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
    };

    sendChannel.onmessage = (event) => {
      appendMessage("receive", event.data as string);
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

    localConnection.onicecandidate = (e) =>{
      if (e.candidate) {
        console.log("emit ice-candidate")
        socket.emit("ice-candidate", JSON.stringify(e.candidate))
      }
    }

    socket.on("ice-candidate", (candidate) => {
      if (candidate) {
        console.log("add ice-candidate")
        localConnection.addIceCandidate(JSON.parse(candidate) as RTCIceCandidate)
      }
    })

    socket.on("server-answer", (desc: string) => {
      console.log("server-answer")
      localConnection.setRemoteDescription(JSON.parse(desc) as RTCSessionDescription)
      setSendMessage(() => ((message: string) => {
        if (message) {
          setInputValue("");
          appendMessage("send", message);
          sendChannel.send(message);
        }
      }))
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
    <div>
      <h1>Client Page</h1>
      {warning && <div>some errors: {warning}</div>}
      {messages.map((message, index) => (
        <div key={index}>
          <div>{message.direction === "send" ? "我" : "对方"}</div>
          <div>{message.message}</div>
        </div>
      ))}
      {sendMessage && (
        <div>
          <input type="text" value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
          <button onClick={() => {
            sendMessage(inputValue)
          }}>Send</button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const sid = new URLSearchParams(window.location.search).get("sid");

  return (
    <div className="font-sans p-4">
      {sid ? <ClientPage sid={sid!} />  : <ServerPage />}
    </div>
  );
}
