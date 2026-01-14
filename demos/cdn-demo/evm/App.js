import { ref, computed, watch } from 'vue';
const { TronLinkEvmAdapter } = window['@tronweb3/tronwallet-adapter-tronlink-evm'];
const { MetaMaskEvmAdapter } = window['@tronweb3/tronwallet-adapter-metamask-evm'];

export default {
    setup() {
        const options = [new TronLinkEvmAdapter(), new MetaMaskEvmAdapter()];

        const queryString = window.location.search || '';
        const params = new URLSearchParams(queryString);
        const selectedAdapterName = ref(params.get('wallet') || 'MetaMask');

        watch(selectedAdapterName, () => {
            window.location.search = '?wallet=' + selectedAdapterName.value;
        });
        const selectedAdapter = computed(() => options.find((option) => option.name === selectedAdapterName.value));
        const connectedAddress = ref('');

        async function onConnect() {
            log('[Event] Connected');
        }
        function onAccountsChanged(account) {
            log('[Event] AccountsChanged: ', account);
            connectedAddress.value = account?.[0];
        }
        async function onChainChanged(account) {
            log('[Event] ChainChanged: ', account);
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
            log('Connect successfully: ', selectedAdapter.value.address);
        }
        async function handleSignMessage() {
            const m = 'Hello world';
            const res = await selectedAdapter.value.signMessage({ message: m });
            log('Sign message successfully: ', res);
        }
        const receiverAddress = ref('');
        async function handleTransfer() {
            const transaction = {
                value: '0x1',
                to: receiverAddress.value,
                from: selectedAdapter.value.address,
            };
            log('SendTransaction: ', transaction);
            await selectedAdapter.value.sendTransaction(transaction);
            log('Send successfully.');
        }

        return { options, selectedAdapterName, connectedAddress, receiverAddress, handleConnect, handleSignMessage, handleTransfer };
    },
    template: `<div class="wallet-demo">
      <select v-model="selectedAdapterName" class="wallet-select">
        <option v-for="option of options" :value="option.name">{{option.name}}</option>
      </select>
      <div style="margin-bottom:12px;">
        <div><strong>Connected Address:</strong> {{connectedAddress || 'Not connected'}}</div>
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
