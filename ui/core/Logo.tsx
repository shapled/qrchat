import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  user-select: none;
`;

const LeftSection = styled.div`
  /* width: 50%; */
  height: 36px;
  background-color: #f4f4f4;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  font-weight: bold;
  color: #333;
  border-radius: 10px;
  margin-right: 4px;
  padding: 8px 16px;
  border: 1px solid #ccc;
`;

const RightSection = styled.div`
  /* width: 50%; */
  height: 36px;
  width: 36px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-gap: 4px;
`;

const GridItem = styled.div`
  background-color: #e0e0e0;
  border-radius: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Block1 = styled(GridItem)`
  background-color: #f5f5f5;
`;

const Block2 = styled(GridItem)`
  background-color: #e6e6e6;
`;

const Block3 = styled(GridItem)`
  background-color: #d9d9d9;
`;

const Block4 = styled(GridItem)`
  background-color: #cccccc;
`;

const ConnectorCircle = styled.div`
  width: 20px;
  height: 20px;
  background-color: #333;
  border-radius: 50%;
`;

export const Logo = () => {
  return (
    <Container>
      <LeftSection>QRChat</LeftSection>
      <RightSection>
        <Block2></Block2>
        <Block3></Block3>
        <Block1></Block1>
        <Block4></Block4>
      </RightSection>
    </Container>
  );
};
