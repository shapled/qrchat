import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { searchPeerServerID } from "~/store/db.server";
import { Commands, Description } from "../common/apiv1.server";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

type LoaderData = {
  sid?: string;
  desc?: Description;
  warning?: string;
};

export const loader: LoaderFunction = ({
  request,
}) => {
  const url = new URL(request.url);
  const sid = url.searchParams.get("sid");
  if (!sid) { return json({}) }
  const desc = searchPeerServerID(sid);
  if (!desc) { return json({ warning: `No such peer server id ${sid}` }) }
  return json({ sid, desc });
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
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const waitForConnection = async (peerID: string, callback: (desc: Description) => void) => {
      const response = await fetch(`/apiv1/${Commands.GetPeerClient}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sid: peerID }),
      });
  
      if (response.status == 502) {
        await waitForConnection(peerID, callback);
      } else if (response.status != 200) {
        console.log("error:", response.statusText);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await waitForConnection(peerID, callback);
      } else {
        const data = await response.json()
        callback(data.desc);
      }
    }

    const localConnection = new RTCPeerConnection(configuration);
    const sendChannel = localConnection.createDataChannel("sendChannel");
    sendChannel.onopen = (event) => {
      console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
    };
    sendChannel.onclose = (event) => {
      console.log('handleSendChannelStatusChange:', sendChannel.readyState, event)
    };
    sendChannel.onmessage = (event)=>{
          console.log('event.data',event.data)
    }
  
    localConnection.onicecandidate = (e) =>{
      console.log('a on ice candidate',e)
    }
  
    localConnection
      .createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() => fetch(`/apiv1/${Commands.SetPeerServer}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ desc: localConnection.localDescription }),
      }))
      .then(resp => resp.json())
      .then(data => {
        setSid(data.sid);
        waitForConnection(data.sid, (desc) => {
          localConnection.setRemoteDescription(desc as RTCSessionDescription)
          setSendMessage(() => ((message: string) => {
            if (message) {
              sendChannel.send(message);
            }
          }))
        })
      })
      .catch((error) => {
        console.log(`Unable to create an offer: ${error.toString()}`);
      });
    
    return () => {
      localConnection.close();
    }
  }, [])

  return (
    <div>
      <h1>Server Page</h1>
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
            setMessages
          }}>Send</button>
        </div>
      )}
    </div>
  )
};

type ClientPageProps = {
  sid: string;
  desc: Description;
}

const ClientPage = (props: ClientPageProps) => {
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('');

  const appendMessage = (direction: "send" | "receive", message: string) => {
    setMessages(messages => [{ message, direction }, ...messages])
  }

  useEffect(() => {
    const localConnection = new RTCPeerConnection(configuration);
  
    localConnection.onicecandidate = (e) =>{
      console.log('a on ice candidate',e)
    }
  
    localConnection.ondatachannel = (event)=>{
      const receiveChannel = event.channel
      receiveChannel.onmessage = (event) => appendMessage("receive", event.data as string);
      receiveChannel.onopen = () => {
        if (receiveChannel) {
          console.log(`Receive channel's status has changed to ${receiveChannel.readyState}`);
        }
      };
      receiveChannel.onclose = () => {
        if (receiveChannel) {
          console.log(`Receive channel's status has changed to ${receiveChannel.readyState}`);
        }
      };
      setSendMessage(() => ((message: string) => {
        if (message) {
          receiveChannel.send(message)
        }
      }))
    }
  
    localConnection.setRemoteDescription(props.desc as RTCSessionDescription)
      .then(() => localConnection.createAnswer())
      .then(answer => localConnection.setLocalDescription(answer))
      .then(() => fetch(`/apiv1/${Commands.SetPeerClient}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sid: props.sid,
          desc: localConnection.localDescription,
        }),
      }))
      .catch((error) => {
        console.log(`Unable to create an offer: ${error.toString()}`);
      });

    return () => {
      localConnection.close();
    }
  }, [props.sid, props.desc]);

  return (
    <div>
      <h1>Client Page</h1>
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
            setMessages
          }}>Send</button>
        </div>
      )}
    </div>
  );
};

type WarningPageProps = {
  warning: string;
}

const WarningPage = (props: WarningPageProps) => {
  return (
    <div>
      <h1>Warning Page</h1>
      <div>some errors: {props.warning}</div>
      <a href="/">回到首页</a>
    </div>
  )
};

export default function Index() {
  const data = useLoaderData<LoaderData>();

  return (
    <div className="font-sans p-4">
      {data.warning ? <WarningPage warning={data.warning} /> 
        : data.desc ? <ClientPage desc={data.desc} sid={data.sid!} /> 
        : <ServerPage />}
    </div>
  );
}
