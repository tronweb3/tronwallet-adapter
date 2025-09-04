
const tronWeb = new window.TronWeb.TronWeb({
    fullHost: 'https://api.nileex.io',
    // fullHost: 'https://api.trongrid.io',
    privateKey: '',
});const log = function (...args) {
  console.log('Adapter:', ...args);
};
let address;
const receiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';
const { TronLinkAdapter, BitKeepAdapter, WalletConnectAdapter } = window['@tronweb3/tronwallet-adapters'];
let adapter;
const tronlinkAdapter = new TronLinkAdapter({
  openTronLinkAppOnMobile: true,
  openUrlWhenWalletNotFound: false,
  checkTimeout: 5000,
});

const bitkeepAdapter = new BitKeepAdapter({
  openTronLinkAppOnMobile: true,
  openUrlWhenWalletNotFound: false,
  checkTimeout: 3000,
});

const walletconnectAdapter = new WalletConnectAdapter({
  network: 'Nile',
  options: {
      relayUrl: 'wss://relay.walletconnect.com',
      // example WC app project ID
      projectId: '5fc507d8fc7ae913fff0b8071c7df231',
      metadata: {
          name: 'Test DApp',
          description: 'JustLend WalletConnect',
          url: 'https://your-dapp-url.org/',
          icons: ['https://your-dapp-url.org/mainLogo.svg'],
      },
  },
  web3ModalConfig: {
      themeMode: 'dark',
      themeVariables: {
          '--wcm-z-index': '1000'
      },
  }
});


adapter = tronlinkAdapter;

adapter.on('readyStateChanged', () => {
  log('readyState: ', adapter.readyState);
});
adapter.on('connect', () => {
  log('connect: ', adapter.address);
  address = adapter.address;
  adapter
      .network()
      .then((res) => {
          log(res);
      })
      .catch((e) => {
          log(e);
      });
});
adapter.on('stateChanged', (state) => {
  log('stateChanged: ', state);
});
adapter.on('accountsChanged', (data, preaddr) => {
  log('accountsChanged: current', data, ' pre: ', preaddr);
});

adapter.on('chainChanged', (data) => {
  log('chainChanged: ', data);
});

adapter.on('disconnect', () => {
  log('disconnect');
});

const connectBtn = document.querySelector('#connectBtn');
const disconnectBtn = document.querySelector('#disconnectBtn');
const signMessageBtn = document.querySelector('#signMessageBtn');
const signTransactionBtn = document.querySelector('#signTransactionBtn');

connectBtn.addEventListener('click', onConnect);
disconnectBtn.addEventListener('click', onDisconnect);
signMessageBtn.addEventListener('click', onSignMessage);
signTransactionBtn.addEventListener('click', onSignTransaction);

async function onConnect() {
  const res = await adapter.connect();
  log('connect successfully: ', adapter.address);
  address = adapter.address;
}

async function onDisconnect() {
  await adapter.disconnect();
  log('disconnect successfully ');
  address = undefined;
}

async function onSignMessage() {
  const m = 'Hello world';
  const res = await adapter.signMessage(m);
  log('sign message successfully: ', res);
  const address = await tronWeb.trx.verifyMessageV2(m, res);
  log('verify successfully');
}

async function onSignTransaction() {
  const transaction = await tronWeb.transactionBuilder.sendTrx(receiver, tronWeb.toSun(0.000001), adapter.address);
  const signedTransaction = await adapter.signTransaction(transaction);
  const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
  log('send successfully.');
}