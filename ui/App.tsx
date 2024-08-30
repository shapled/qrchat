import { Flex, App as AntdApp, Button } from "antd";
import { Header } from "./core/Header";
import { PeerClient } from "./core/PeerClient";
import { PeerServer } from "./core/PeerServer";
import { css } from "@emotion/css";
import React, { useState } from "react";

const CardButton = (props: { borderColor: string, bgColor: string, children: React.ReactNode }) => {
  const [hover, setHover] = useState(false);

  return (
    <div className={css`
      background-color: ${props.borderColor};
      border-radius: 16px;
      height: 208px;
      width: 100%;
      position: relative;
    `}>
      <Flex 
        justify="center"
        align="center"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={css`
          background-color: ${props.bgColor};
          border-radius: 8px;
          border: none;
          font-size: 20px;
          color: white;
          cursor: pointer;
          position: absolute;
          top: ${ hover ? 0 : 64 }px;
          bottom: ${ hover ? 0 : 64 }px;
          left: ${ hover ? 0 : 64 }px;
          right: ${ hover ? 0 : 64 }px;
          transition: top 0.3s, bottom 0.3s, left 0.3s, right 0.3s;
        `}
      >
        <span className={css`
          font-size: 50px;
          font-weight: bold;
          background: linear-gradient(270deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00ffff, #0000ff, #7f00ff);
          background-size: 400% 400%;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: rainbow-animation 300s ease infinite;

          @keyframes rainbow-animation {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}>
          {props.children}
        </span>
      </Flex>
    </div>
  )
}

export default function App() {
  const sid = new URLSearchParams(window.location.search).get("sid");

  return (
    <AntdApp>
      <Flex vertical className={css`
        height: 100vh;
        width: 100%;
        max-width: 720px;
        margin: 0 auto;  
      `}>
        <Header />
        {/* <Flex vertical justify="center" align="center" className={css`
          padding: 0 8px 16px 8px;
          flex-grow: 1;  
        `}>
          {sid ? <PeerClient sid={sid!} />  : <PeerServer />}
        </Flex> */}
        <div>
          <CardButton borderColor="#ffedb1" bgColor="#ffd54f">I'm a server</CardButton>
          <CardButton borderColor="#b1e2ff" bgColor="#4fc3f7">I'm a client</CardButton>
          {/* <div className={css`
            flex-grow: 1;
          `}>I'm a server.</div>
          <div className={css`
            flex-grow: 1;
          `}>I'm a client.</div> */}
        </div>
      </Flex>
    </AntdApp>
  );
}
