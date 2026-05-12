<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';
import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';
import type { Adapter } from '@tronweb3/abstract-adapter-evm';
import { ElButton, ElOption, ElSelect } from 'element-plus';

const adapters: Adapter[] = [new OkxWalletEvmAdapter(), new MetaMaskEvmAdapter()];

const selectedIndex = ref(0);
const connected = ref(false);
const address = ref('');
const readyState = ref('');
const signResult = ref('');
let cleanupListeners: (() => void) | undefined;

function currentAdapter(): Adapter {
    return adapters[selectedIndex.value];
}

function updateState() {
    const adapter = currentAdapter();
    connected.value = adapter.connected;
    address.value = adapter.address || '';
    readyState.value = adapter.readyState;
}

function listenAdapter() {
    cleanupListeners?.();
    const adapter = currentAdapter();
    const handleReadyStateChanged = () => updateState();
    const handleAccountsChanged = () => updateState();
    const handleDisconnect = () => updateState();

    adapter.on('readyStateChanged', handleReadyStateChanged);
    adapter.on('accountsChanged', handleAccountsChanged);
    adapter.on('disconnect', handleDisconnect);
    cleanupListeners = () => {
        adapter.off('readyStateChanged', handleReadyStateChanged);
        adapter.off('accountsChanged', handleAccountsChanged);
        adapter.off('disconnect', handleDisconnect);
    };
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

async function signMessage() {
    try {
        const msg = 'Hello from Vue UI EVM Demo!';
        const sig = await currentAdapter().signMessage({ message: msg });
        signResult.value = sig;
    } catch (e: any) {
        console.error('EVM signMessage error:', e);
        alert('Sign failed: ' + e.message);
    }
}

function onAdapterChange() {
    signResult.value = '';
    listenAdapter();
    updateState();
}

onMounted(() => {
    listenAdapter();
    updateState();
});

onUnmounted(() => {
    cleanupListeners?.();
});
</script>

<template>
    <div class="evm-demo">
        <h2>EVM Adapter Demo (OKXWallet + MetaMask)</h2>
        <p class="evm-row">
            <span>Select EVM Adapter:</span>
            <ElSelect v-model="selectedIndex" size="default" class="evm-select" @change="onAdapterChange">
                <ElOption v-for="(adapter, idx) in adapters" :key="adapter.name" :label="adapter.name" :value="idx" />
            </ElSelect>
        </p>
        <p class="evm-row">
            <span>ReadyState:</span>
            <span class="evm-value">{{ readyState || '-' }}</span>
        </p>
        <p class="evm-row">
            <span>Address:</span>
            <span class="evm-value evm-address">{{ address || 'Not connected' }}</span>
        </p>
        <div class="evm-actions">
            <ElButton :disabled="connected" @click="connect">Connect</ElButton>
            <ElButton :disabled="!connected" @click="signMessage">Sign Message</ElButton>
        </div>
        <div v-if="signResult" class="evm-info">
            <p><strong>Signature:</strong> {{ signResult.slice(0, 40) }}...</p>
        </div>
    </div>
</template>

<style scoped>
.evm-demo {
    margin-top: 40px;
    margin-bottom: 120px;
    color: #213547;
    text-align: left;
}
.evm-demo h2 {
    margin: 30px 0 10px;
}
.evm-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
    color: #213547;
    word-break: break-all;
}
.evm-row > span:first-child {
    width: 160px;
}
.evm-select {
    width: 180px;
}
.evm-value {
    color: #606266;
}
.evm-address {
    max-width: 720px;
}
.evm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
}
.evm-actions :deep(.el-button) {
    min-width: 88px;
    height: 46px;
    margin-left: 0;
    border: 1px solid #11131f;
    border-radius: 4px;
    background: #11131f;
    color: #fff;
    font-weight: 600;
}
.evm-actions :deep(.el-button:hover),
.evm-actions :deep(.el-button:focus) {
    border-color: #11131f;
    background: #11131f;
    color: #fff;
    opacity: 0.88;
}
.evm-actions :deep(.el-button.is-disabled),
.evm-actions :deep(.el-button.is-disabled:hover),
.evm-actions :deep(.el-button.is-disabled:focus) {
    border-color: #3f4149;
    background: #3f4149;
    color: rgba(255, 255, 255, 0.55);
    opacity: 1;
}
.evm-info {
    margin-top: 8px;
    color: #606266;
    word-break: break-all;
}
@media screen and (max-width: 800px) {
    .evm-row {
        align-items: flex-start;
        flex-direction: column;
    }

    .evm-row > span:first-child,
    .evm-select {
        width: 100%;
    }
}
</style>
