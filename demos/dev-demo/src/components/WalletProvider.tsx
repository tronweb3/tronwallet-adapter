import { WalletProvider as _WalletProvider, useLocalStorage } from "@tronweb3/tronwallet-adapter-react-hooks";
import type { PropsWithChildren} from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  TronLinkAdapter} from '@tronweb3/tronwallet-adapters';
import {
  BitKeepAdapter,
  GateWalletAdapter,
  ImTokenAdapter,
  LedgerAdapter,
  OkxWalletAdapter,
  TokenPocketAdapter,
  WalletConnectAdapter,
  FoxWalletAdapter,
  BybitWalletAdapter,
  TomoWalletAdapterName,
  TomoWalletAdapter,
} from '@tronweb3/tronwallet-adapters';
import { walletconnectConfig } from '../config';
import type { Adapter, AdapterName} from "@tronweb3/tronwallet-abstract-adapter";
import { WalletReadyState } from "@tronweb3/tronwallet-abstract-adapter";

export interface WalletContextType {
  selectedAdapterName: AdapterName;
  setSelectedAdapterName: (name: AdapterName) => void;
  adapter: Adapter | undefined;
  adapters: Adapter[];
  connectionState: {
    connected: boolean;
    connecting: boolean;
    address: string;
    readyState: WalletReadyState;
    chainId: string;
  };
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
}
const Context = createContext<WalletContextType>({
  selectedAdapterName: TomoWalletAdapterName,
  setSelectedAdapterName: () => {
    //
  },
  adapter: undefined,
  connectionState: {
    connected: false,
    connecting: false,
    address: '',
    readyState: WalletReadyState.NotFound,
    chainId: '',
  },
  adapters: []
});
export default function WalletProvider({ children }: PropsWithChildren) {
  const adapters = useMemo(() => {
    return [
      new TomoWalletAdapter(),
      new TronLinkAdapter(),
      new TokenPocketAdapter(),
      new OkxWalletAdapter(),
      new BitKeepAdapter(),
      new GateWalletAdapter(),
      new ImTokenAdapter(),
      new FoxWalletAdapter(),
      new BybitWalletAdapter(),
      new LedgerAdapter(),
      new WalletConnectAdapter(walletconnectConfig),
    ];
  }, []);
  const walletName = decodeURIComponent(new URLSearchParams(location.search).get('wallet') || '');
  const [selectedAdapterName, _setSelectedAdapterName] = useState(walletName as AdapterName || TomoWalletAdapterName);

  const setSelectedAdapterName = useCallback((selectedAdapterName: AdapterName) => {
    _setSelectedAdapterName(selectedAdapterName);
    setTimeout(() => {
      window.history.replaceState({}, '', `/?wallet=${encodeURIComponent(selectedAdapterName)}`);
    }, 200);
  }, [_setSelectedAdapterName])
  const adapter = useMemo(() => adapters.find((adapter) => adapter.name === selectedAdapterName), [selectedAdapterName, adapters]);
  const [connectionState, setConnectionState] = useState({
    connected: false,
    connecting: false,
    address: '',
    readyState: WalletReadyState.NotFound,
    chainId: '',
  })
 
  function onReadyStateChanged(readyState: WalletReadyState) {
    setConnectionState(preState => ({
      ...preState,
      connected: adapter?.connected || false,
      connecting: adapter?.connecting || false,
      address: adapter?.address || '',
      readyState,
    }));
  }
  function onConnect() {
    setConnectionState(preState => ({
      ...preState,
      connected: true,
      address: adapter?.address || '',
    }));
    (adapter as unknown as TronLinkAdapter)?.network?.().then((network) => {
      setConnectionState(preState => ({
        ...preState,
        chainId: network.chainId,
      }))
    });
  }

  function onAccountsChanged(account: string) {
    setConnectionState(preState => ({
      ...preState,
      address: account,
    }));
  }

  function onDisconnect() {
    setConnectionState(preState => ({
      ...preState,
      connected: false,
      address: '',
    }));
  }
  function onChainChanged(chainData: unknown) {
    setConnectionState(preState => ({
      ...preState,
      chainId: (chainData as { chainId: string }).chainId,
    }));
  }
  useEffect(() => {
    setConnectionState(preState => ({ 
      ...preState,
      connected: adapter?.connected || false,
      connecting: adapter?.connecting || false,
      address: adapter?.address || '',
      readyState: adapter?.readyState || WalletReadyState.NotFound,
    }));
    
    if (adapter) {
      adapter.on('readyStateChanged', onReadyStateChanged);
      adapter.on('connect', onConnect);
      adapter.on('accountsChanged', onAccountsChanged);
      adapter.on('disconnect', onDisconnect);
      adapter.on('chainChanged', onChainChanged);
      if (adapter?.connected) {
        (adapter as unknown as TronLinkAdapter)?.network?.().then((network) => {
          setConnectionState(preState => ({
            ...preState,
            chainId: network.chainId,
          }))
        });
      }
    }

    return () => {
      adapter?.removeAllListeners();
    };
    
  }, [adapter]);

  async function connect() {
    setConnectionState(preState => ({
      ...preState,
      connected: false,
      connecting: true,
    }));
    try {
      await adapter?.connect();
      setConnectionState(preState => ({
        ...preState,
        connected: adapter?.connected || false,
        connecting: false,
        address: adapter?.address || '',
      }));
    } catch (e: unknown) {
      setConnectionState(preState => ({
        ...preState,
        connecting: false,
      }));
    }
    
  }

  async function disconnect() {
    await adapter?.disconnect();
    setConnectionState(preState => ({
      ...preState,
      connected: false,
      connecting: false,
      address: '',
    }));
  }
  return <Context.Provider value={{
    adapter,
    adapters,
    selectedAdapterName,
    setSelectedAdapterName,
    connectionState,
    connect,
    disconnect,
  }}>{children}</Context.Provider>
}

export function useWallet(): WalletContextType {
  return useContext(Context);
}