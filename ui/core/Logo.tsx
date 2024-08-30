import { Space } from 'antd';
import { css } from '@emotion/css'

export const Logo = () => {
  return (
    <Space className={css`
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      user-select: none;
    `}>
      <div className={css`
        /* width: 50%; */
        height: 36px;
        width: 36px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        grid-gap: 4px;

        & > div {
          background-color: #e0e0e0;
          border-radius: 5px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
      `}>
        <div className={css`background-color: #e6e6e6;`} />
        <div className={css`background-color: #d9d9d9;`} />
        <div className={css`background-color: #f5f5f5;`} />
        <div className={css`background-color: #cccccc;`} />
      </div>
      <div className={css`
        height: 36px;
        /* background-color: #f4f4f4; */
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 24px;
        font-weight: bold;
        color: #333;
        /* border-radius: 10px; */
        padding: 8px 16px;
        /* border: 1px solid #ccc; */  
      `}>QRChat</div>
    </Space>
  );
};
