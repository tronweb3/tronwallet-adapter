import { ref, computed, watch } from 'vue';
const { TronLinkAdapter } = window['@tronweb3/tronwallet-adapter-tronlink'];
const { BitKeepAdapter } = window['@tronweb3/tronwallet-adapter-bitkeep'];
const { GuardaAdapter } = window['@tronweb3/tronwallet-adapter-guarda'];
const { OkxWalletAdapter } = window['@tronweb3/tronwallet-adapter-okxwallet'];
const { TokenPocketAdapter } = window['@tronweb3/tronwallet-adapter-tokenpocket'];
const { GateWalletAdapter } = window['@tronweb3/tronwallet-adapter-gatewallet'];
const { ImTokenAdapter } = window['@tronweb3/tronwallet-adapter-imtoken'];
const { BybitWalletAdapter } = window['@tronweb3/tronwallet-adapter-bybit'];
const { FoxWalletAdapter } = window['@tronweb3/tronwallet-adapter-foxwallet'];
const { TomoWalletAdapter } = window['@tronweb3/tronwallet-adapter-tomowallet'];
const { TrustAdapter } = window['@tronweb3/tronwallet-adapter-trust'];
const { BinanceWalletAdapter } = window['@tronweb3/tronwallet-adapter-binance'];
const { LedgerAdapter } = window['@tronweb3/tronwallet-adapter-ledger'];
const { WalletConnectAdapter } = window['@tronweb3/tronwallet-adapter-walletconnect'];

const tronWeb = new window.TronWeb.TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: '',
});
export default {
    setup() {
        const options = [
            new TomoWalletAdapter(),
            new TronLinkAdapter(),
            new TokenPocketAdapter(),
            new OkxWalletAdapter(),
            new BitKeepAdapter(),
            new TrustAdapter(),
            new GateWalletAdapter(),
            new ImTokenAdapter(),
            new FoxWalletAdapter(),
            new BybitWalletAdapter(),
            new BinanceWalletAdapter(),
            new GuardaAdapter(),
            new LedgerAdapter(),
            new WalletConnectAdapter(walletConnectConfig),
        ];
        const queryString = window.location.search || '';
        const params = new URLSearchParams(queryString);

        const selectedAdapterName = ref(params.get('wallet') || 'TronLink');
        watch(selectedAdapterName, () => {
            window.location.search = '?wallet=' + selectedAdapterName.value;
        });

        const selectedAdapter = computed(() => options.find((option) => option.name === selectedAdapterName.value));
        const connectedAddress = ref('');
        const currentNetwork = ref('');

        async function onConnect() {
            log('[Event] Connected');
        }
        function onAccountsChanged(account) {
            log('[Event] AccountsChanged: ', account);
            connectedAddress.value = account;
        }
        async function onChainChanged(account) {
            log('[Event] ChainChanged: ', account);
            try {
                const network = await selectedAdapter.value.network();
                currentNetwork.value = network.chainId;
            } catch (e) {
                log('Get network error: ', e);
            }
        }

        watch(
            selectedAdapter,
            (cur, pre) => {
                pre?.removeAllListeners();
                cur.on('connect', onConnect);
                cur.on('accountsChanged', onAccountsChanged);
                cur.on('chainChanged', onChainChanged);
            },
            {
                immediate: true,
            }
        );

        function log(...args) {
            console.log(`${selectedAdapterName.value}:`, ...args);
        }
        async function handleConnect() {
            await selectedAdapter.value.connect();
            connectedAddress.value = selectedAdapter.value.address || '';
            try {
                const network = await selectedAdapter.value.network();
                currentNetwork.value = network.chainId;
            } catch (e) {
                log('Get network error: ', e);
            }
            log('Connect successfully: ', selectedAdapter.value.address);
        }
        async function handleSignMessage() {
            const m = 'Hello world';
            const res = await selectedAdapter.value.signMessage(m);
            log('Sign message successfully: ', res);
            const address = await tronWeb.trx.verifyMessageV2(m, res);
            log('Verify result: ', address === selectedAdapter.value.address);
        }
        const receiverAddress = ref('');
        async function handleTransfer() {
            const transaction = await tronWeb.transactionBuilder.sendTrx(receiverAddress.value, tronWeb.toSun(0.000001), selectedAdapter.value.address);
            console.log(transaction);
            const signedTransaction = await selectedAdapter.value.signTransaction(transaction);
            const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
            if (res?.result) {
                log('Send transaction successfully.');
            }
        }

        return { options, selectedAdapterName, connectedAddress, currentNetwork, receiverAddress, handleConnect, handleSignMessage, handleTransfer };
    },
    template: `<div class="wallet-demo">
      <select v-model="selectedAdapterName" class="wallet-select">
        <option v-for="option of options" :value="option.name">{{option.name}}</option>
      </select>
      <div style="margin-bottom:12px;">
        <div><strong>Connected Address:</strong> {{connectedAddress || 'Not connected'}}</div>
        <div><strong>Current Network:</strong> {{currentNetwork}}</div>
      </div>
      <div class="wallet-actions">
        <button @click="handleConnect" class="wallet-btn">Connect</button>
        <button @click="handleSignMessage" class="wallet-btn">Sign Message</button>
      </div>
      <div class="wallet-transfer">
        <input type="text" placeholder="Please input your receiver address" v-model="receiverAddress" class="wallet-input" />
        <button @click="handleTransfer" class="wallet-btn">Transfer</button>
      </div>
    </div>`,
};

const walletConnectConfig = {
    network: 'Nile',
    options: {
        relayUrl: 'wss://relay.walletconnect.com',
        // example WC app project ID
        projectId: '',
        metadata: {
            name: 'Test DApp',
            description: 'Test dApp',
            url: 'https://your-dapp-url.org/',
            icons: ['https://your-dapp-url.org/mainLogo.svg'],
        },
    },
    web3ModalConfig: {
        themeMode: 'dark',
        themeVariables: {
            '--wcm-z-index': '1000',
        },
    },
};
