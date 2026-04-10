<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';
import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';
import type { AdapterEvm } from '@tronweb3/abstract-adapter-evm';

const adapters: AdapterEvm[] = [new OkxWalletEvmAdapter(), new MetaMaskEvmAdapter()];

const selectedIndex = ref(0);
const connected = ref(false);
const address = ref('');
const readyState = ref('');
const signResult = ref('');

function currentAdapter(): AdapterEvm {
    return adapters[selectedIndex.value];
}

function updateState() {
    const adapter = currentAdapter();
    connected.value = adapter.connected;
    address.value = adapter.address || '';
    readyState.value = adapter.readyState;
}

async function connect() {
    try {
        await currentAdapter().connect();
        updateState();
    } catch (e: any) {
        console.error('EVM connect error:', e);
        alert('Connect failed: ' + e.message);
    }
}

async function disconnect() {
    try {
        await currentAdapter().disconnect();
        updateState();
        signResult.value = '';
    } catch (e: any) {
        console.error('EVM disconnect error:', e);
    }
}

async function signMessage() {
    try {
        const msg = 'Hello from Vue UI EVM Demo!';
        const sig = await currentAdapter().signMessage(msg);
        signResult.value = sig;
    } catch (e: any) {
        console.error('EVM signMessage error:', e);
        alert('Sign failed: ' + e.message);
    }
}

function onAdapterChange() {
    signResult.value = '';
    updateState();
}

onMounted(() => {
    updateState();
});
</script>

<template>
    <div class="evm-demo">
        <h2>EVM Adapter Demo (OKXWallet + MetaMask)</h2>
        <div class="evm-controls">
            <label>Select EVM Adapter: </label>
            <select v-model.number="selectedIndex" @change="onAdapterChange">
                <option v-for="(adapter, idx) in adapters" :key="adapter.name" :value="idx">
                    {{ adapter.name }}
                </option>
            </select>
            <span class="ready-state">ReadyState: {{ readyState }}</span>
        </div>
        <div class="evm-actions">
            <button v-if="!connected" @click="connect">Connect</button>
            <button v-else @click="disconnect">Disconnect</button>
            <button :disabled="!connected" @click="signMessage">Sign Message</button>
        </div>
        <div v-if="address" class="evm-info">
            <p><strong>Address:</strong> {{ address }}</p>
        </div>
        <div v-if="signResult" class="evm-info">
            <p><strong>Signature:</strong> {{ signResult.slice(0, 40) }}...</p>
        </div>
    </div>
</template>

<style scoped>
.evm-demo {
    margin-top: 40px;
    padding: 20px;
    border: 2px solid #4fc08d;
    border-radius: 8px;
    background: #f9f9f9;
}
.evm-controls {
    margin: 12px 0;
    display: flex;
    align-items: center;
    gap: 12px;
}
.evm-controls select {
    padding: 4px 8px;
}
.ready-state {
    font-size: 0.85em;
    color: #666;
}
.evm-actions {
    display: flex;
    gap: 8px;
    margin: 12px 0;
}
.evm-actions button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #4fc08d;
    color: white;
    cursor: pointer;
}
.evm-actions button:disabled {
    background: #ccc;
    cursor: not-allowed;
}
.evm-info {
    margin-top: 8px;
    word-break: break-all;
}
</style>
