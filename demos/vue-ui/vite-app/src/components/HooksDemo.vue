<script setup lang="ts">
import { useWallet } from '@tronweb3/tronwallet-adapter-vue-hooks';
import { ElButton, ElInput, ElOption, ElSelect } from 'element-plus';
import { tronWeb } from '../tronweb';
import { ref } from 'vue';
const { wallets, wallet, address, connected, select, connect, disconnect, signMessage, signTransaction } = useWallet();
console.log(wallets, wallet, address, connected);

const receiver = ref();
async function onSelect(v: any) {
    console.log('onselect', v);
    await select(v);
}

async function onConnect() {
    await connect();
}

async function onDisconnect() {
    await disconnect();
}

async function onSignMessage() {
    const res = await signMessage('Hello world!');
    alert(res);
}

async function onSignTransaction() {
    const transaction = await tronWeb.transactionBuilder.sendTrx(
        receiver.value,
        tronWeb.toSun(0.000001),
        wallet.value?.adapter.address
    );
    const signedTransaction = await signTransaction(transaction);
    // const signedTransaction = await tronWeb.trx.sign(transaction);
    const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
    alert(JSON.stringify(res));
}
</script>

<template>
    <p>Current Wallet: {{ wallet?.adapter.name }}</p>
    <p>Connection State: {{ wallet?.adapter.state }}</p>
    <p>Address : {{ address }}</p>
    <ElSelect :modelValue="wallet?.adapter.name" @change="onSelect">
        <ElOption v-for="wallet of wallets" :key="wallet.adapter.name" :value="wallet.adapter.name"></ElOption>
    </ElSelect>
    <ElButton :disabled="connected" @click="onConnect">connect</ElButton>
    <ElButton :disabled="!connected" @click="onDisconnect">disconnect</ElButton>
    <ElButton :disabled="!connected" @click="onSignMessage">signMessage</ElButton>
    <div>
        <ElInput v-model="receiver" placeholder="Input the receiver address" />
        <ElButton :disabled="!connected" @click="onSignTransaction">transfer</ElButton>
    </div>
</template>

<style scoped>
p {
    color: #888;
}
</style>
