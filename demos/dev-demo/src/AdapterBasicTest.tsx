import type { SelectChangeEvent } from '@mui/material';
import { Alert, Box, Button, Input, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { Adapter, Chain } from '@tronweb3/abstract-adapter-evm';
import { WalletReadyState } from '@tronweb3/abstract-adapter-evm';
import { useLocalStorage } from '@tronweb3/tronwallet-adapter-react-hooks';
import { BinanceEvmAdapter } from '@tronweb3/tronwallet-adapter-binance-evm';
import { TronLinkEvmAdapter } from '@tronweb3/tronwallet-adapter-tronlink-evm';
import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { utils } from 'tronweb';
import { ethers, keccak256, toUtf8Bytes } from 'ethers';

export const AdapterBasicTest = memo(function AdapterBasicTest() {
  const adapters = useMemo(() => [new BinanceEvmAdapter(), new MetaMaskAdapter(), new TronLinkEvmAdapter()], []);
  const [selectedName, setSelectedName] = useLocalStorage('SelectedAdapter', 'BinanceEvm');
  const [account, setAccount] = useState('');
  const [readyState, setReadyState] = useState(WalletReadyState.Loading);
  const [chainId, setChainId] = useState<string>('');

  function handleChange(event: SelectChangeEvent<string>) {
    setSelectedName(event.target.value);
  }
  const adapter = useMemo(() => adapters.find((adapter) => adapter.name === selectedName) || adapters[0], [selectedName, adapters]);
  const log = useCallback(
    function (...args: unknown[]) {
      console.log(`[${selectedName} Adapter] `, ...args);
    },
    [selectedName]
  );
  useEffect(() => {
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
      log('readyStateChanged: ', adapter.readyState);
      setReadyState(adapter.readyState);
    });
    adapter.on('connect', async () => {
      log('connect: ', adapter.address);
    });
    adapter.on('accountsChanged', (accounts) => {
      log('accountsChanged: current', accounts);
      setAccount(adapter.address || '');
      if (adapter.address) {
        adapter
          .network()
          .then((res: any) => {
            log('network()', res);
            setChainId(res);
          })
          .catch((e: Error) => {
            console.error('network() error:', e);
          });
      } else {
        setChainId('');
      }
    });

    adapter.on('chainChanged', (data) => {
      log('chainChanged: ', data);
      setChainId(data);
    });

    adapter.on('disconnect', () => {
      log('disconnect');
      setAccount(adapter.address || '');
    });

    return () => {
      adapter.removeAllListeners();
    };
  }, [adapter, log]);

  const Items = useMemo(
    () =>
      adapters.map((adapter) => (
        <MenuItem value={adapter.name} key={adapter.name}>
          <Stack width={200} flexDirection={'row'}>
            <img src={adapter.icon} alt={adapter.name} style={{ width: 20, height: 20, marginRight: 8 }} />
            {adapter.name}
          </Stack>
        </MenuItem>
      )),
    [adapters]
  );

  async function onConnect() {
    const address = await adapter.connect();
    log('connected: address ', address);
    setAccount(address);
  }
  return (
    <Box sx={{ margin: '20px' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Typography gutterBottom>Select the Adapter:</Typography>
        <Select style={{ marginLeft: 15 }} size="small" value={selectedName} onChange={handleChange}>
          {Items}
        </Select>
      </Box>
      <InfoShow label="Selected wallet readyState:" value={readyState} />
      <InfoShow label="Connected account address:" value={account} />
      <InfoShow label="Current network you choose:" value={chainId} />
      <Box>
        <Button variant="contained" onClick={onConnect}>
          Connect
        </Button>
      </Box>
      <SectionSwitchChain adapter={adapter} />
      <SectionSign adapter={adapter} />
      <SectionTriggerContract adapter={adapter} />
    </Box>
  );
});

function InfoShow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', margin: '10px 0' }}>
      <Typography gutterBottom style={{ width: 250 }}>
        {label}
      </Typography>
      <Typography gutterBottom>{value}</Typography>
    </Box>
  );
}

const SectionSign = memo(function SectionSign({ adapter }: { adapter: Adapter }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('Hello, Adapter');
  const [signedMessage, setSignedMessage] = useState('');
  const [receiver, setReceiver] = useState('');

  async function onSignTransaction() {
    const chainId = await adapter.network();
    const transaction = {
      value: '0x' + Number(11).toString(16),
      to: receiver,
      from: adapter.address,
      chainId: chainId,
    };
    const signedTransaction = await adapter.sendTransaction(transaction);
    setOpen(true);
  }

  const onSignMessage = useCallback(
    async function () {
      const res = await adapter.signMessage({ message, address: adapter.address! });
      setSignedMessage(res);
      console.log('Sign string signature: ', res);
    },
    [adapter, message, setSignedMessage]
  );

  const onVerifyMessage = useCallback(
    async function () {
      const utf8Message = utils.ethersUtils.toUtf8Bytes(message);
      const hashedMessage = utils.ethersUtils.keccak256(
        utils.ethersUtils.concat([utils.ethersUtils.toUtf8Bytes('\x19Ethereum Signed Message:\n'), utils.ethersUtils.toUtf8Bytes(String(utf8Message.length)), utf8Message])
      );
      const address = utils.crypto.ecRecover(hashedMessage, signedMessage.slice(2));
      console.log('Signature is valid: ', address.slice(2).toLowerCase() === adapter.address!.slice(2).toLowerCase());
    },
    [message, signedMessage, adapter]
  );

  const onSignTypedData = useCallback(
    async function () {
      const chainId = await adapter.network();
      const typedData = {
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
          Person: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'wallet',
              type: 'address',
            },
          ],
          Mail: [
            {
              name: 'from',
              type: 'Person',
            },
            {
              name: 'to',
              type: 'Person',
            },
            {
              name: 'contents',
              type: 'string',
            },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: Number(chainId),
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello, Bob!你好“”abc123……&*））《》',
        },
      };
      const signature = await adapter.signTypedData({ address: adapter.address || '', typedData });
      console.log('SignTypedData signature: ', signature);
      const isValid = await verifyEip712Signature({ Person: typedData.types.Person, Mail: typedData.types.Mail }, typedData.domain, typedData.message, signature, adapter.address || '');
      console.log('SignTypedData isValid: ', isValid);
    },
    [adapter]
  );

  return (
    <Box margin={'20px 0'}>
      <Box>
        <Typography variant="h5" gutterBottom>
          Sign Usage
        </Typography>
        <TextField label="Message to sign" size="small" value={message} onChange={(e) => setMessage(e.target.value)} />

        <Button variant="contained" onClick={onSignMessage}>
          Sign Message
        </Button>

        <Button variant="contained" disabled={!signedMessage} onClick={onVerifyMessage}>
          Verify Signed Message
        </Button>
        <Button variant="contained" onClick={onSignTypedData}>
          Sign Typed Data
        </Button>
      </Box>
      <Box sx={{ marginTop: '10px' }}>
        <TextField label="Receiver address" size="small" value={receiver} onChange={(e) => setReceiver(e.target.value)} />
        <Button variant="contained" onClick={onSignTransaction}>
          Transfer
        </Button>
      </Box>
    </Box>
  );
});

const SectionTriggerContract = function ({ adapter }: { adapter: Adapter }) {
  const [number, setNumber] = useState('0');
  const [contractAddress, setContractAddress] = useState('');
  async function deployContract() {
    // Deploy contract
    const byteCode =
      '0x608060405234801561001057600080fd5b506101c0806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100ae565b60405180910390f35b610073600480360381019061006e91906100fa565b61008b565b005b600060016000546100869190610156565b905090565b8060008190555050565b6000819050919050565b6100a881610095565b82525050565b60006020820190506100c3600083018461009f565b92915050565b600080fd5b6100d781610095565b81146100e257600080fd5b50565b6000813590506100f4816100ce565b92915050565b6000602082840312156101105761010f6100c9565b5b600061011e848285016100e5565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061016182610095565b915061016c83610095565b925082820190508082111561018457610183610127565b5b9291505056fea26469706673582212209410fe094761ba1df4dc51e0ffea2cfd9c83dba2f7a18f4c4812a9a67234f15664736f6c63430008120033';
    const provider1 = await adapter.getProvider();
    if (!provider1) {
      return;
    }
    const chainId = await adapter.network();
    const provider = new ethers.BrowserProvider(provider1);
    const nonce = await provider.getTransactionCount(adapter.address!, 'latest');
    const baseDeployContranctTx = {
      from: adapter.address,
      //   TronLinkEvm require to address
      to: adapter.name === 'TronLinkEvm' ? '0x0000000000000000000000000000000000000000' : null,
      data: byteCode,
      chainId: chainId,
      //   value: '0x0',
      //   nonce: `0x${Number(nonce).toString(16)}`,
    };
    console.log(baseDeployContranctTx);
    const signedTransaction = await adapter.sendTransaction(baseDeployContranctTx);
    console.log('transaction hash: ', signedTransaction);
  }

  async function triggerContract() {
    const selector = `${keccak256(toUtf8Bytes('store(uint256)')).slice(0, 10)}`;
    const param1 = Number(number).toString(16).padStart(64, '0');
    const data = selector + param1;
    const transaction = {
      from: adapter.address,
      to: contractAddress,
      data,
      gas: '0x19023',
    };
    const signedTransaction = await adapter.sendTransaction(transaction);
    console.log('signedTransaction', signedTransaction);
  }

  async function readContract() {
    const erc20Abi = ['function retrieve() view returns (uint256)'];
    const provider1 = await adapter.getProvider();
    if (!provider1) {
      return;
    }
    const provider = new ethers.BrowserProvider(provider1);

    const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
    const result = await contract.retrieve();
    console.log('read contract result: ', result);
  }
  return (
    <Box margin={'20px 0px'}>
      <Typography variant="h5" gutterBottom>
        Interact with SmartContract
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '500px' }}>
        <TextField fullWidth label="Set the contract:" size="small" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} />
        <TextField sx={{ marginTop: '20px' }} fullWidth label="Set the number:" size="small" value={number} onChange={(e) => setNumber(e.target.value)} />
      </Box>
      <Box sx={{ marginTop: '20px' }}>
        <Button variant="contained" onClick={deployContract}>
          Deploy Contract
        </Button>
        <Button variant="contained" onClick={triggerContract}>
          Store Number to Contract
        </Button>
        <Button variant="contained" onClick={readContract}>
          Get the Number from Contract
        </Button>
      </Box>
    </Box>
  );
};

const SectionSwitchChain = memo(function SectionSwitchChain({ adapter }: { adapter: Adapter }) {
  const [selectedChainId, setSelectedChainId] = useState<`0x${string}`>('0x1');
  function onSwitchChain() {
    adapter.switchChain(selectedChainId);
  }
  return (
    <Box margin={'20px 0'}>
      <Typography variant="h5" gutterBottom>
        Switch Chain
      </Typography>
      <Select labelId="demo-simple-select-label" id="demo-simple-select" value={selectedChainId} size="small" onChange={(e) => setSelectedChainId(e.target.value as Chain['chainId'])}>
        <MenuItem value={'0x1'}>Ethereum Mainnet</MenuItem>
        <MenuItem value={'0x38'}>BSC Mainnet</MenuItem>
        <MenuItem value={'0x2105'}>Base Mainnet</MenuItem>
        <MenuItem value={'0xa4b1'}>Arbitrum One</MenuItem>
        <MenuItem value={'0x539'}>Localhost Test</MenuItem>
      </Select>

      <Button style={{ margin: '0 20px' }} onClick={onSwitchChain} variant="contained">
        Switch Chain to {selectedChainId}
      </Button>
    </Box>
  );
});

async function verifyEip712Signature(types: any, domain: any, message: Record<string, any>, signature: string, expectedSigner: string) {
  try {
    const signerAddress = ethers.verifyTypedData(domain, types, message, signature);

    return ethers.isAddress(signerAddress) && signerAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error: any) {
    console.error('Verify failed：', error.message);
    return false;
  }
}
