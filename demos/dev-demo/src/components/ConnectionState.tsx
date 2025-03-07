import { Box, Stack, styled, Typography } from "@mui/material";
import { useWallet } from "./WalletProvider";
import LinkOffIcon from './DisconnectedIcon';
import LinkIcon from './ConnectedIcon';
import { useMemo } from "react";

const StateBox = styled(Box)({
  width: '100%',
  borderRadius: 10,
  backgroundColor: '#e8e8ef',
  padding: '10px 10px 10px 20px',
  boxSizing: 'border-box',
  marginBottom: '25px',
});

const StateLabel = styled(Typography)({
  fontSize: '16px',
  fontWeight: 500,
  color: '#7b7c9d',
  lineHeight: '49px',
});

const StateText = styled(Typography)({
  fontSize: '16px',
  color: '#07094c',
  lineHeight: '49px',
  fontFamily: 'Roboto',
  textAlign: 'right',
});
export default function ConnectionState() {

  const { selectedAdapterName, adapters, connectionState } = useWallet();
  
  const adapter = useMemo(() => adapters.find((adapter) => adapter.name === selectedAdapterName), [selectedAdapterName, adapters]);

  return <StateBox>
    <Stack direction="row" justifyContent={'space-between'}>
      <StateLabel>Selected wallet readyState</StateLabel>
      <StateText>{connectionState.readyState || '-'}</StateText>
    </Stack>
    <Stack direction="row" justifyContent={'space-between'}>
      <StateLabel>Current connection status</StateLabel>
      <Stack direction="row" spacing={1} alignItems={'center'}>
        { connectionState.connected ? <LinkIcon/> : <LinkOffIcon/>}
        <StateText>{adapter ? connectionState.connected ? 'Connected' : 'Disconnected' : '-'}</StateText>
      </Stack>
    </Stack>
    <Stack direction="row" justifyContent={'space-between'}>
      <StateLabel>Connected account </StateLabel>
      <StateText>{connectionState.address ? `${connectionState.address.slice(0, 10)}...${connectionState.address.slice(-10)}` : '-'}</StateText>
    </Stack>
    <Stack direction="row" justifyContent={'space-between'}>
      <StateLabel>Current network you choose</StateLabel>
      <StateText>{connectionState.address ? connectionState.chainId || '-' : '-'}</StateText>
    </Stack>
  </StateBox>
}

