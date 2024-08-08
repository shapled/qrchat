import { Divider, Flex, Tooltip } from "antd"
import { Logo } from "./Logo"
import { GithubOutlined } from "@ant-design/icons"

export const Header = () => {
  return (
    <div style={{ height: "64px" }}>
      <Flex justify="space-between" align="center" style={{ padding: "0 32px", height: "100%" }}>
        <Tooltip title="qrchat.top">
          <a href="/"><Logo /></a>
        </Tooltip>
        <Flex>
          <Tooltip title="Github">
            <a href="https://github.com/shapled/qrchat" target="_blank" rel="noreferrer" style={{ fontSize: '24px' }}><GithubOutlined /></a>
          </Tooltip>
        </Flex>
      </Flex>
      <Divider style={{ margin: 0 }} />
    </div>
  )
}
