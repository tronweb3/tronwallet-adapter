import { WalletProvider as _WalletProvider, useLocalStorage } from "@tronweb3/tronwallet-adapter-react-hooks";
import { ContextType, createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  BitKeepAdapter,
  GateWalletAdapter,
  ImTokenAdapter,
  LedgerAdapter,
  OkxWalletAdapter,
  TokenPocketAdapter,
  TronLinkAdapter,
  WalletConnectAdapter,
  FoxWalletAdapter,
  BybitWalletAdapter,
  TronLinkAdapterName
} from '@tronweb3/tronwallet-adapters';
import { walletconnectConfig } from '../config';
import { Adapter, AdapterName, WalletReadyState } from "@tronweb3/tronwallet-abstract-adapter";

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
  selectedAdapterName: TronLinkAdapterName,
  setSelectedAdapterName: () => { },
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

  const [selectedAdapterName, setSelectedAdapterName] = useLocalStorage<AdapterName>('TronWalletAdapterUsage', TronLinkAdapterName);

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
    (adapter as TronLinkAdapter)?.network().then((network) => {
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
        (adapter as TronLinkAdapter)?.network().then((network) => {
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
    await adapter?.connect();
    setConnectionState(preState => ({
      ...preState,
      connected: adapter?.connected || false,
      connecting: false,
      address: adapter?.address || '',
    }));
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