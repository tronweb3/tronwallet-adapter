import type { SelectChangeEvent } from '@mui/material';
import { Alert, Box, Button, Input, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { Adapter, Chain } from '@tronweb3/abstract-adapter-evm';
import { WalletReadyState } from '@tronweb3/abstract-adapter-evm';
import { useLocalStorage } from '@tronweb3/tronwallet-adapter-react-hooks';
import {
    BinanceEvmAdapter
} from '@tronweb3/tronwallet-adapter-binance-evm';
import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { utils } from 'tronweb';
import { ethers, keccak256, toUtf8Bytes } from "ethers";

const receiver = '0x18B0FDE2FEA85E960677C2a41b80e7557AdcbAE0';

export const AdapterBasicTest = memo(function AdapterBasicTest() {
    const adapters = useMemo(
        () => [new BinanceEvmAdapter(), new MetaMaskAdapter()],
        []
    );
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
                setChainId('')
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
        log('connected: address ', address)
        setAccount(address);
    }
    return (
        <Box>
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

const SectionSign = memo(function SectionSign({ adapter }: { adapter: Adapter; }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('Hello, Adapter');
    const [signedMessage, setSignedMessage] = useState('');

    async function onSignTransaction() {
        const chainId = await adapter.network();
        const transaction = {
            value: '0x' + Number(11).toString(16),
            to: receiver,
            from: adapter.address,
            chainId: chainId
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
            const hashedMessage = utils.ethersUtils.keccak256(utils.ethersUtils.concat([utils.ethersUtils.toUtf8Bytes('\x19Ethereum Signed Message:\n'), utils.ethersUtils.toUtf8Bytes(String(utf8Message.length)), utf8Message]))
            const address = utils.crypto.ecRecover(hashedMessage, signedMessage.slice(2))
            console.log('Signature is valid: ', address.slice(2).toLowerCase() === adapter.address!.slice(2).toLowerCase());
        },
        [message, signedMessage, adapter]
    );

    const onSignTypedData = useCallback(async function () {
        const typedData = {
            types: {
                EIP712Domain: [
                    {
                        name: "name",
                        type: "string"
                    },
                    {
                        name: "version",
                        type: "string"
                    },
                    {
                        name: "chainId",
                        type: "uint256"
                    },
                    {
                        name: "verifyingContract",
                        type: "address"
                    }
                ],
                Person: [
                    {
                        name: "name",
                        type: "string"
                    },
                    {
                        name: "wallet",
                        type: "address"
                    }
                ],
                Mail: [
                    {
                        name: "from",
                        type: "Person"
                    },
                    {
                        name: "to",
                        type: "Person"
                    },
                    {
                        name: "contents",
                        type: "string"
                    }
                ]
            },
            primaryType: "Mail",
            domain: {
                name: "Ether Mail",
                version: "1",
                chainId: 1,
                verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
            },
            message: {
                from: {
                    name: "Cow",
                    wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
                },
                to: {
                    name: "Bob",
                    wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
                },
                contents: "Hello, Bob!你好“”abc123……&*））《》"
            }
        };
        const signature = await adapter.signTypedData({ address: adapter.address || '', typedData });
        console.log('SignTypedData signature: ', signature);
        const isValid = await verifyEip712Signature({ Person: typedData.types.Person, Mail: typedData.types.Mail }, typedData.domain, typedData.message, signature, adapter.address || '')
        console.log('SignTypedData isValid: ', isValid)
    }, [adapter])

    return (
        <Box margin={'20px 0'}>
            <Typography variant="h5" gutterBottom>
                Sign Usage
            </Typography>
            <TextField label="Message to sign" size="small" value={message} onChange={(e) => setMessage(e.target.value)} />

            <Button variant="contained" onClick={onSignTransaction}>
                Transfer
            </Button>
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
    );
});

const SectionTriggerContract = function({ adapter }: { adapter: Adapter }) {
    const [number, setNumber] = useState('0');
    const [contractAddress, setContractAddress] = useState('');
    async function deployContract() {
        // Deploy contract
        const byteCode = '0x6080604052348015600e575f5ffd5b506101298061001c5f395ff3fe6080604052348015600e575f5ffd5b50600436106030575f3560e01c80632e64cec11460345780636057361d14604e575b5f5ffd5b603a6066565b60405160459190608d565b60405180910390f35b606460048036038101906060919060cd565b606e565b005b5f5f54905090565b805f8190555050565b5f819050919050565b6087816077565b82525050565b5f602082019050609e5f8301846080565b92915050565b5f5ffd5b60af816077565b811460b8575f5ffd5b50565b5f8135905060c78160a8565b92915050565b5f6020828403121560df5760de60a4565b5b5f60ea8482850160bb565b9150509291505056fea264697066735822122063f96a57b86a37af1ac0fbf522233470beb0ae3e330dcafa317cb897259fa87364736f6c634300081e0033';
        const provider = await adapter.getProvider();
        if (!provider) {
            return;
        }
        const chainId = await adapter.network();
        const baseDeployContranctTx = {
            from: adapter.address,
            to: null,
            data: byteCode,
            chainId: chainId,
        };
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
            gas: "0x19023",
        };
        const signedTransaction = await adapter.sendTransaction(transaction);
        console.log('signedTransaction', signedTransaction);
    }

    async function readContract() {
        const erc20Abi = [
            "function retrieve() view returns (uint256)",
        ];
        const provider1 = await adapter.getProvider();
        if (!provider1) {
            return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum)

        const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
        const result = await contract.retrieve();
        console.log('read contract result: ', result);
    }
    return (
        <Box margin={'20px 0'}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '500px' }}>
                <Typography gutterBottom>Set the contract:</Typography>
                <Input fullWidth value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography gutterBottom>Set the number:</Typography>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </Box>
            <Box>
                <Button variant="contained"  onClick={deployContract}>Deploy Contract</Button>
                <Button variant="contained"  onClick={triggerContract}>Store Number to Contract</Button>
                <Button variant="contained"  onClick={readContract}>Get the Number from Contract</Button>
            </Box>
        </Box>
    );
}


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
            <Typography variant="h6" gutterBottom>
                You can switch chain by click the button.
            </Typography>
            <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={selectedChainId}
                size="small"
                onChange={(e) => setSelectedChainId(e.target.value as Chain['chainId'])}
            >
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
    const signerAddress = ethers.verifyTypedData(
      domain, 
      types,
      message, 
      signature
    );

    return ethers.isAddress(signerAddress) && 
           signerAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error: any) {
    console.error("Verify failed：", error.message);
    return false;
  }
}

