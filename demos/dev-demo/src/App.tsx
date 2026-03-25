import { Box, Tab, Tabs, styled } from '@mui/material';
import { useState } from 'react';
import WalletProvider from './components/WalletProvider.js';
import BgImg from './images/bg.png';
import TronAdapterDemo from './TronAdapterDemo.js';
import { EvmAdapterDemo } from './EvmAdapterDemo.js';
import { useLocalStorage } from '@tronweb3/tronwallet-adapter-react-hooks';

const Container = styled('div')({
  minHeight: '100vh',
  boxSizing: 'border-box',
  margin: '0',
  display: 'flex',
  flexDirection: 'column',
  background: `url(${BgImg}) no-repeat center bottom/100% 100%`,
  '@media (max-width: 780px)': {
    height: 'unset',
  },
});

const StyledTabs = styled(Tabs)({
  background: 'rgba(255,255,255,0.15)',
  backdropFilter: 'blur(10px)',
  '& .MuiTabs-indicator': {
    backgroundColor: 'rgba(7, 9, 76, 1)',
    height: 3,
  },
});

const StyledTab = styled(Tab)({
  fontFamily: 'Wix Madefor Display, sans-serif',
  fontWeight: 700,
  fontSize: '16px',
  color: 'rgba(7, 9, 76, 0.6)',
  textTransform: 'none',
  padding: '16px 32px',
  '&.Mui-selected': {
    color: 'rgba(7, 9, 76, 1)',
  },
});

function App() {
  const [tabIndex, setTabIndex] = useLocalStorage('TabIndex', 0);
  return (
    <Container className="App">
      <WalletProvider>
        <Box>
          <StyledTabs value={tabIndex} onChange={(_e, v) => setTabIndex(v)} centered>
            <StyledTab label="Tron Wallet Adapter" />
            <StyledTab label="EVM Wallet Adapter" />
          </StyledTabs>
          {tabIndex === 0 && <TronAdapterDemo />}
          {tabIndex === 1 && <EvmAdapterDemo />}
        </Box>
      </WalletProvider>
    </Container>
  );
}

export default App;
