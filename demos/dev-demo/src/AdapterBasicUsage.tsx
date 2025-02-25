import React, { useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import AdapterSelect from './components/AdapterSelect';
import ConnectionState from './components/ConnectionState';
import { Button, Typography } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useWallet } from './components/WalletProvider';
import SignUsage from './components/SignUsage';
import SwitchChain from './components/SwitchChain';

const Container = styled('div')({
  paddingTop: '150px',
  margin: '20px auto',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
});
const Title = styled(Typography)({
  fontSize: '40px',
  fontWeight: 800,
  marginBottom: '20px',
  textAlign: 'center',
  color: 'rgba(7, 9, 76, 1)',
});

const MainContent = styled('div')({
  width: '100%',
  maxWidth: '1200px',
  margin: '20px auto',
  display: 'flex',
});

const BasicInfoWrap = styled('div')(({ width = '610px', marginLeft = '0px' }: {
  width?: string,
  marginLeft?: string | number,
}) => ({
  width,
  marginLeft,
  flex: '1 0 auto',
}));

const ConnectButton = styled(Button)({
  width: '100%',
  lineHeight: '60px',
  textAlign: 'center',
  backgroundColor: '#000000',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 700,
  padding: 0,
  transition: 'background-color 0.5s ease',
  marginLeft: 0,
  backdropFilter: 'blur(30px)',
  boxShadow: '0px 30px 30px -20px rgba(0, 0, 0, 0.40)',
  '&:hover': {
    backgroundColor: '#07094c',
  },
  '&.Mui-disabled': {
    color: '#fff',
  }
})
const AdapterBasicUsage: React.FC = () => {
  const { connectionState, connect, disconnect } = useWallet();

  
  return (
    <Container>
      <Title>Adapter Basic Usage</Title>
      <MainContent>
        <BasicInfoWrap>
          <AdapterSelect />
          <ConnectionState />
          <ConnectButton onClick={connectionState.connected ? disconnect : connect} disabled={connectionState.connecting}>
            {connectionState.connected ? <LinkOffIcon color='error' /> : <LinkIcon color='success' /> }
            <span style={{ marginLeft: '10px' }}>{connectionState.connected ? 'Disconnect' : 'Connect'}</span>
          </ConnectButton>
        </BasicInfoWrap>
        <SignUsage/>
        <SwitchChain />
      </MainContent>
    </Container>
  );
};

export default AdapterBasicUsage;