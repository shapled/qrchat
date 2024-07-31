import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Commands, Description, fetchResult } from "../common/apiv1";

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
  return json({ sid: url.searchParams.get("sid") });
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
  
    localConnection
      .createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() => fetchResult(Commands.emitServerInit, { desc: localConnection.localDescription }))
      .then(data => {
        let done = false;

        setSid(data.sid);

        localConnection.onicecandidate = (e) => {
          if (e.candidate) {
            fetchResult(Commands.emitServerIceCandidate, { sid: data.sid, candidate: e.candidate })
              .catch((error) => { setWarning(`Unable to emit server ice candidate event: ${error.toString()}`); })
          }
        }

        (async () => {
          while (!done) {
            try {
              const result = await fetchResult(Commands.awaitClientIceCandidate, { sid: data.sid })
              result.candidates.map((candidate: RTCIceCandidate) => localConnection.addIceCandidate(candidate))
            } catch (error) {
              console.log("Unable to await client ice candidate event:", error);
            }
          }
        })()

        fetchResult(Commands.awaitDone, { sid: data.sid })
          .then(() => done = true)
          .catch((error) => { console.log("ignore awaitDone error:", error) })

        fetchResult(Commands.awaitClientAnswer, { sid: data.sid })
          .then((data) => {
            console.log("remote desc data: ", data)
            localConnection.setRemoteDescription(data.desc as RTCSessionDescription)
            setSendMessage(() => ((message: string) => {
              if (message) {
                setInputValue("");
                appendMessage("send", message);
                sendChannel.send(message);
              }
            }))
          })
          .catch((error) => {
            setWarning(`Unable to set remote desc: ${error.toString()}`);
          });
      })
      .catch((error) => {
        setWarning(`Unable to create an offer: ${error.toString()}`);
      });
    
    return () => {
      localConnection.close();
    }
  }, [])

  return (
    <div>
      <h1>Server Page</h1>
      {warning && <div>some errors: {warning}</div>}
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
    let done = false;
    let cid = 0;
    const sid = props.sid;
    const localConnection = new RTCPeerConnection(configuration);
  
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

      done = true;
      fetchResult(Commands.emitDone, { sid: props.sid, cid })
        .catch((error) => { setWarning(`Unable to emit done event: ${error.toString()}`); })

      setSendMessage(() => ((message: string) => {
        if (message) {
          setInputValue("");
          appendMessage("send", message);
          receiveChannel.send(message)
        }
      }))
    }

    fetchResult(Commands.emitClientInit, { sid: props.sid })
      .then(data => {
        cid = data.cid;

        fetchResult(Commands.awaitServerInit, { sid: props.sid, cid })
          .then((data) => {
            return localConnection.setRemoteDescription(data.desc)
          })
          .then(() => localConnection.createAnswer())
          .then(answer => {
            localConnection.onicecandidate = (e) =>{
              if (e.candidate) {
                fetchResult(Commands.emitClientIceCandidate, { sid, cid, candidate: e.candidate })
                  .catch((error) => { setWarning(`Unable to emit client ice candidate event: ${error.toString()}`); })
              }
            }

            (async () => {
              while (!done) {
                try {
                  const result = await fetchResult(Commands.awaitServerIceCandidate, { sid, cid })
                  result.candidates.map((candidate: RTCIceCandidate) => localConnection.addIceCandidate(candidate))
                } catch (error) {
                  console.log("Unable to await client ice candidate event:", error);
                }
              }
            })()
    
            return localConnection.setLocalDescription(answer)
          })
          .then(() => {
            return fetchResult(Commands.emitClientAnswer, { sid, cid, desc: localConnection.localDescription })
          })
          .catch((error) => {
            setWarning(`Unable to create an offer: ${error.toString()}`);
          });
      })
      .catch((error) => { setWarning(`Unable to emit client init event: ${error.toString()}`); })

    return () => {
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
            setMessages
          }}>Send</button>
        </div>
      )}
    </div>
  );
};

export default function Index() {
  const data = useLoaderData<LoaderData>();

  return (
    <div className="font-sans p-4">
      {data.sid ? <ClientPage sid={data.sid!} />  : <ServerPage />}
    </div>
  );
}
