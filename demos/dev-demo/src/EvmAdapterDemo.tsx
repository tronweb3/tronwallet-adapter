import type { SelectChangeEvent } from '@mui/material';
import { Box, Button, Input, MenuItem, Select, Stack, Typography, styled } from '@mui/material';
import type { Adapter, Chain } from '@tronweb3/abstract-adapter-evm';
import { WalletReadyState } from '@tronweb3/abstract-adapter-evm';
import { useLocalStorage } from '@tronweb3/tronwallet-adapter-react-hooks';
import { TronLinkEvmAdapter, BinanceEvmAdapter, MetaMaskEvmAdapter, TrustEvmAdapter } from '@tronweb3/tronwallet-adapters';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { utils } from 'tronweb';
import { ethers, keccak256, toUtf8Bytes } from 'ethers';

// ─── Shared Styled Components ────────────────────────────────────────────────

const Title = styled(Typography)({
  fontFamily: 'Wix Madefor Display, sans-serif',
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
  alignItems: 'flex-start',
  gap: '20px',
  '@media (max-width: 780px)': {
    flexDirection: 'column',
    alignItems: 'center',
  },
});

const BasicInfoWrap = styled('div')({
  width: '330px',
  flexShrink: 0,
  '@media (max-width: 780px)': {
    width: '100%',
  },
});

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
    color: 'rgba(255, 255, 255, 0.92)',
    background: 'linear-gradient(135deg, rgba(20, 18, 118, 0.58), rgba(70, 67, 223, 0.5))',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0px 24px 24px -20px rgba(20, 18, 118, 0.45)',
    cursor: 'not-allowed',
    opacity: 1,
  },
});

const InfoCard = styled('div')({
  background: 'rgba(255, 255, 255, 0.55)',
  backdropFilter: 'blur(10px)',
  borderRadius: '10px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
  marginBottom: '12px',
});

const SectionCard = styled('div')(({ background = 'linear-gradient(210deg, #CEA5BA -1.29%, #4643DF 21.87%, #4643DF 74.72%, #41B7E9 98.71%)' }: { background?: string }) => ({
  borderRadius: 10,
  background,
  padding: '20px',
  boxSizing: 'border-box',
  flex: '1 1 260px',
  minWidth: '220px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}));

const DarkInput = styled(Input)({
  width: '100%',
  height: '46px',
  borderRadius: '10px',
  backgroundColor: 'rgba(20, 18, 118, 0.7)',
  padding: '0 16px',
  border: '1px solid transparent',
  transition: 'border-color 0.5s ease',
  '&.Mui-focused': { borderColor: 'rgba(255, 255, 255, 0.5)' },
  '& .MuiInput-input': { caretColor: 'white', color: 'white' },
  '& .MuiInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
});

const SectionButton = styled(Button)({
  height: '46px',
  color: '#fff',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.5s ease',
  '&:hover': { backgroundColor: '#fff', color: '#000' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)' },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export const EvmAdapterDemo = memo(function EvmAdapterDemo() {
  const adapters = useMemo(() => [new BinanceEvmAdapter(), new MetaMaskEvmAdapter(), new TronLinkEvmAdapter(), new TrustEvmAdapter()], []);
  const [selectedName, setSelectedName] = useLocalStorage('SelectedAdapter', 'BinanceEvm');
  const [account, setAccount] = useState('');
  const [readyState, setReadyState] = useState(WalletReadyState.Loading);
  const [chainId, setChainId] = useState<string>('');

  function handleChange(event: SelectChangeEvent<string>) {
    setSelectedName(event.target.value);
  }

  const adapter = useMemo(() => adapters.find((a) => a.name === selectedName) || adapters[0], [selectedName, adapters]);
  const log = useCallback(
    function (...args: unknown[]) {
      console.log(`[${selectedName} Adapter] `, ...args);
    },
    [selectedName]
  );

  useEffect(() => {
    setChainId('');
    setAccount(adapter.address || '');
    setReadyState(adapter.readyState);
    if (adapter.connected) {
      adapter
        // @ts-ignore
        .network()
        .then((res: any) => {
          log('network()', res);
          setChainId(res);
        })
        .catch((e: Error) => {
          console.error('network() error:', e);
        });
    }

    adapter.on('readyStateChanged', () => {
      setReadyState(adapter.readyState);
    });
    adapter.on('connect', async () => {
      log('connect: ', adapter.address);
    });
    adapter.on('accountsChanged', (accounts) => {
      log('accountsChanged:', accounts);
      setAccount(adapter.address || '');
      if (adapter.address) {
        adapter
          .network()
          .then((res: any) => setChainId(res))
          .catch(() => {});
      } else {
        setChainId('');
      }
    });
    adapter.on('chainChanged', (data: any) => {
      setChainId(data);
    });
    adapter.on('disconnect', () => {
      setAccount(adapter.address || '');
      setChainId('');
    });

    return () => {
      adapter.removeAllListeners();
    };
  }, [adapter, log]);

  const Items = useMemo(
    () =>
      adapters.map((a) => (
        <MenuItem value={a.name} key={a.name}>
          <Stack flexDirection="row" alignItems="center" gap={1}>
            <img src={a.icon} alt={a.name} style={{ width: 20, height: 20 }} />
            {a.name}
          </Stack>
        </MenuItem>
      )),
    [adapters]
  );

  async function onConnect() {
    const address = await adapter.connect();
    log('connected address:', address);
    setAccount(address);
  }

  return (
    <Box sx={{ paddingTop: '60px', '@media (max-width: 780px)': { paddingTop: '30px' } }}>
      <Title>EVM Wallet Adapter</Title>
      <MainContent>
        {/* Left Column: Adapter Info + Connect */}
        <BasicInfoWrap>
          <Box sx={{ marginBottom: '12px' }}>
            <Select
              value={selectedName}
              onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
              size="small"
              sx={{
                width: '100%',
                height: '46px',
                backgroundColor: 'rgba(20, 18, 118, 0.7)',
                borderRadius: '10px',
                color: 'white',
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSvgIcon-root': { color: 'white' },
              }}
            >
              {Items}
            </Select>
          </Box>
          <InfoCard>
            <Typography sx={{ color: '#333', fontSize: 13, fontWeight: 600 }}>Ready State</Typography>
            <Typography sx={{ color: '#555', fontSize: 13 }}>{readyState}</Typography>
          </InfoCard>
          <InfoCard>
            <Typography sx={{ color: '#333', fontSize: 13, fontWeight: 600 }}>Address</Typography>
            <Typography sx={{ color: '#555', fontSize: 13, wordBreak: 'break-all', maxWidth: '55%', textAlign: 'right' }}>{account || '—'}</Typography>
          </InfoCard>
          <InfoCard>
            <Typography sx={{ color: '#333', fontSize: 13, fontWeight: 600 }}>Network</Typography>
            <Typography sx={{ color: '#555', fontSize: 13 }}>{chainId || '—'}</Typography>
          </InfoCard>
          <ConnectButton onClick={onConnect} disabled={!!account}>
            {account ? 'Connected to Wallet' : 'Connect Wallet'}
          </ConnectButton>
        </BasicInfoWrap>

        {/* Right Column: Action Cards */}
        <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <SectionSign adapter={adapter} connected={!!account} />
          <SectionTriggerContract adapter={adapter} connected={!!account} />
          <SectionSwitchChain adapter={adapter} connected={!!account} />
        </Box>
      </MainContent>
    </Box>
  );
});

// ─── Section: Sign ───────────────────────────────────────────────────────────

const SectionSign = memo(function SectionSign({ adapter, connected }: { adapter: Adapter; connected: boolean }) {
  const [message, setMessage] = useState('Hello, Adapter');
  const [signedMessage, setSignedMessage] = useState('');
  const [receiver, setReceiver] = useState('');

  async function onSignTransaction() {
    const cid = await adapter.network();
    const tx = { value: '0x' + Number(11).toString(16), to: receiver, from: adapter.address, chainId: cid };
    await adapter.sendTransaction(adapter.name === 'Trust Wallet' ? { ...tx, data: '0x' } : tx);
  }

  const onSignMessage = useCallback(async () => {
    const res = await adapter.signMessage({ message, address: adapter.address! });
    setSignedMessage(res);
    console.log('Sign string signature:', res);
  }, [adapter, message]);

  const onVerifyMessage = useCallback(async () => {
    const utf8Message = utils.ethersUtils.toUtf8Bytes(message);
    const hashedMessage = utils.ethersUtils.keccak256(
      utils.ethersUtils.concat([utils.ethersUtils.toUtf8Bytes('\x19Ethereum Signed Message:\n'), utils.ethersUtils.toUtf8Bytes(String(utf8Message.length)), utf8Message])
    );
    const address = utils.crypto.ecRecover(hashedMessage, signedMessage.slice(2));
    console.log('Signature is valid:', address.slice(2).toLowerCase() === adapter.address!.slice(2).toLowerCase());
  }, [message, signedMessage, adapter]);

  const onSignTypedData = useCallback(async () => {
    const cid = await adapter.network();
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      },
      primaryType: 'Mail',
      domain: { name: 'Ether Mail', version: '1', chainId: Number(cid), verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' },
      message: {
        from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
        to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
        contents: 'Hello, Bob!你好""abc123……&*））《》',
      },
    };
    const signature = await adapter.signTypedData({ address: adapter.address || '', typedData });
    console.log('SignTypedData signature:', signature);
    const isValid = await verifyEip712Signature({ Person: typedData.types.Person, Mail: typedData.types.Mail }, typedData.domain, typedData.message, signature, adapter.address || '');
    console.log('SignTypedData isValid:', isValid);
  }, [adapter]);

  return (
    <SectionCard background="linear-gradient(210deg, #CEA5BA -1.29%, #4643DF 21.87%, #4643DF 74.72%, #41B7E9 98.71%)">
      <Typography variant="h6" fontWeight={700} color="white">
        Sign Usage
      </Typography>
      <DarkInput placeholder="Message to sign" disableUnderline value={message} onChange={(e) => setMessage(e.target.value)} />
      <SectionButton onClick={onSignMessage}>Sign Message</SectionButton>
      <SectionButton disabled={!signedMessage} onClick={onVerifyMessage}>
        Verify Signed Message
      </SectionButton>
      <SectionButton onClick={onSignTypedData}>Sign Typed Data</SectionButton>
      <DarkInput placeholder="Receiver Address" disableUnderline value={receiver} onChange={(e) => setReceiver(e.target.value)} />
      <SectionButton disabled={!connected || !receiver} onClick={onSignTransaction}>
        Transfer
      </SectionButton>
    </SectionCard>
  );
});

// ─── Section: Smart Contract ─────────────────────────────────────────────────

const SectionTriggerContract = function ({ adapter, connected }: { adapter: Adapter; connected: boolean }) {
  const [number, setNumber] = useState('0');
  const [contractAddress, setContractAddress] = useState('');

  async function deployContract() {
    const byteCode =
      '0x608060405234801561001057600080fd5b506101c0806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100ae565b60405180910390f35b610073600480360381019061006e91906100fa565b61008b565b005b600060016000546100869190610156565b905090565b8060008190555050565b6000819050919050565b6100a881610095565b82525050565b60006020820190506100c3600083018461009f565b92915050565b600080fd5b6100d781610095565b81146100e257600080fd5b50565b6000813590506100f4816100ce565b92915050565b6000602082840312156101105761010f6100c9565b5b600061011e848285016100e5565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061016182610095565b915061016c83610095565b925082820190508082111561018457610183610127565b5b9291505056fea26469706673582212209410fe094761ba1df4dc51e0ffea2cfd9c83dba2f7a18f4c4812a9a67234f15664736f6c63430008120033';
    const provider1 = await adapter.getProvider();
    if (!provider1) return;
    const cid = await adapter.network();
    const baseDeployTx = {
      from: adapter.address,
      to: adapter.name === 'TronLinkEvm' ? '0x0000000000000000000000000000000000000000' : null,
      data: byteCode,
      chainId: cid,
    };
    console.log(baseDeployTx);
    const tx = await adapter.sendTransaction(baseDeployTx);
    console.log('transaction hash:', tx);
  }

  async function triggerContract() {
    const selector = `${keccak256(toUtf8Bytes('store(uint256)')).slice(0, 10)}`;
    const param1 = Number(number).toString(16).padStart(64, '0');
    const tx = { from: adapter.address, to: contractAddress, data: selector + param1, gas: '0x19023' };
    const result = await adapter.sendTransaction(tx);
    console.log('signedTransaction', result);
  }

  async function readContract() {
    const provider1 = await adapter.getProvider();
    if (!provider1) return;
    const provider = new ethers.BrowserProvider(provider1);
    const contract = new ethers.Contract(contractAddress, ['function retrieve() view returns (uint256)'], provider);
    const result = await contract.retrieve();
    console.log('read contract result:', result);
  }

  return (
    <SectionCard background="linear-gradient(135deg, rgba(20, 18, 118, 0.85), rgba(70, 67, 223, 0.9))">
      <Typography variant="h6" fontWeight={700} color="white">
        Smart Contract
      </Typography>
      <SectionButton disabled={!connected} onClick={deployContract}>
        Deploy Contract
      </SectionButton>
      <DarkInput placeholder="Contract Address" disableUnderline value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} />
      <DarkInput placeholder="Number" disableUnderline value={number} onChange={(e) => setNumber(e.target.value)} />
      <SectionButton disabled={!connected || !contractAddress} onClick={triggerContract}>
        Store Number
      </SectionButton>
      <SectionButton disabled={!connected || !contractAddress} onClick={readContract}>
        Get Number
      </SectionButton>
    </SectionCard>
  );
};

// ─── Section: Switch Chain ────────────────────────────────────────────────────

const SectionSwitchChain = memo(function SectionSwitchChain({ adapter, connected }: { adapter: Adapter; connected: boolean }) {
  const [selectedChainId, setSelectedChainId] = useState<`0x${string}`>('0x1');
  return (
    <SectionCard background="linear-gradient(45deg, rgba(65, 183, 233, 0.75), rgba(70, 67, 223, 0.95))">
      <Typography variant="h6" fontWeight={700} color="white">
        Switch Chain
      </Typography>
      <Select
        value={selectedChainId}
        size="small"
        onChange={(e) => setSelectedChainId(e.target.value as Chain['chainId'])}
        sx={{
          backgroundColor: 'rgba(20, 18, 118, 0.7)',
          color: 'white',
          borderRadius: '10px',
          height: '46px',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '& .MuiSvgIcon-root': { color: 'white' },
        }}
      >
        <MenuItem value="0x1">Ethereum Mainnet</MenuItem>
        <MenuItem value="0x38">BSC Mainnet</MenuItem>
        <MenuItem value="0x61">BSC Testnet</MenuItem>
        <MenuItem value="0x2105">Base Mainnet</MenuItem>
        <MenuItem value="0xc7">BitTorrent Chain Mainnet</MenuItem>
        <MenuItem value="0x405">BitTorrent Chain Donau</MenuItem>
        <MenuItem value="0xa4b1">Arbitrum One</MenuItem>
        <MenuItem value="0x539">Localhost Test</MenuItem>
      </Select>
      <SectionButton disabled={!connected} onClick={() => adapter.switchChain(selectedChainId).catch((e) => console.error('switchChain error:', e))}>
        Switch to {selectedChainId}
      </SectionButton>
    </SectionCard>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyEip712Signature(types: any, domain: any, message: Record<string, any>, signature: string, expectedSigner: string) {
  try {
    const signerAddress = ethers.verifyTypedData(domain, types, message, signature);
    return ethers.isAddress(signerAddress) && signerAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error: any) {
    console.error('Verify failed:', error.message);
    return false;
  }
}
