import { Button, Flex, Input, QRCode, Space, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useStore } from "./store";
import { CheckOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import Countdown from "antd/es/statistic/Countdown";
import { useShallow } from "zustand/react/shallow";

export const QRCodeBox = () => {
  const [roomID, storeStatus] = useStore(useShallow(state => [state.roomID, state.status]));
  const [copied, setCopied] = useState(false);
  const [deadline, setDeadline] = useState<number | undefined>();
  const [status, setStatus] = useState<"expired" | "active" | "loading" | "scanned" | undefined>("loading")

  const currentURL = new URL(window.location.href);
  const clientUrl = `${currentURL.origin}${currentURL.pathname}?sid=${roomID}`;

  useEffect(() => {
    switch (storeStatus) {
      case "waiting":
        setStatus("loading");
        break;
      case "shaking":
        setDeadline(Date.now() + 1000 * 60);
        setStatus("active");
        break;
      case "connected":
        setStatus("scanned");
        break;
      case "closed":
        setStatus("expired");
        break;
    }
  }, [storeStatus])

  return (
    <Space direction="vertical" align="center">
      <Typography.Title>
        <Flex vertical align="center">
          <span>Scan this QR code</span>
          <span>to start a serverless chat</span>
        </Flex>
      </Typography.Title>
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
                onFinish={() => setStatus("expired") }
              />
            } seconds.
          </Typography.Paragraph>
        </Space>
      )}
    </Space>
  )
};
