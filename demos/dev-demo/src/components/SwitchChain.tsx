import { Button, colors, MenuItem, Select, SelectChangeEvent, styled, Typography } from "@mui/material";
import { UsageBox, UsageTitle } from "./SignUsage";
import { useState } from "react";
import { CHAIN_ID } from "../config";
import { useWallet } from "./WalletProvider";

const Description = styled(Typography)({
  color: 'white',
  fontSize: '14px',
  lineHeight: '16px',
  marginTop: '10px',
  flex: '1 0 auto'
});

const ChainSelect = styled(Select)({
  height: '55px',
  border: '1px solid transparent',
  borderRadius: '10px',
  backgroundColor: 'rgba(120, 158, 227, 1)',
  color: 'rgba(255, 255, 255, 0.5)',
  transition: 'all 0.5s ease',
  padding: '0 10px',
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    color: 'white',
  },
  '&.Mui-focused': {
    color: 'white',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  '& .MuiSelect-select': {
    backgroundColor: 'transparent',
    padding: '0',
    '&:focus': {
      backgroundColor: 'transparent',
    },
  },
  '& .MuiSelect-icon': {
    color: 'white',
  },

  "@media (max-width: 780px)": {
    margin: '50px 0 0'
  }
});
const menuProps = {
  PaperProps: {
    style: {
      backgroundColor: 'rgba(255, 255, 255, 1)',
    },
  },
  MenuListProps: {
    sx: {
      '& .MuiMenuItem-root': {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        color: 'rgba(7, 9, 76, 1)',
        margin: '0 5px',
        borderRadius: '6px',
        lineHeight: '40px',
        transition: 'all 0.5s ease',
        '&:hover': {
          backgroundColor: 'rgba(201, 201, 218, 1)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(201, 201, 218, 1)',
        },
      },
    },
  },
};

const Items = (Object.keys(CHAIN_ID) as Array<keyof typeof CHAIN_ID>).map((key) => (
  <MenuItem value={CHAIN_ID[key]} key={key}>
    {key}
  </MenuItem>
));

const SwitchChainButton = styled(Button)({
  width: '100%',
  height: '55px',
  borderRadius: '10px',
  backgroundColor: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  color: '#fff',
  transition: 'all 0.5s ease',
  margin: '20px 0 0',
  '&:hover': {
    backgroundColor: '#fff',
    color: '#000',
  },
});
export default function SwitchChain() {
  const { adapter } = useWallet();
  const [chainId, setChainId] = useState<string>(CHAIN_ID.Nile);

  function handleChange(e: SelectChangeEvent<unknown>) {
    setChainId(e.target.value as string);
  }

  async function handleSwitchChain() {
    if (!adapter) return;
    await adapter.switchChain(chainId);
  }
  return <UsageBox background=" linear-gradient(211deg, #84E2FF 1.72%, #99BDFF 32.91%, #99BDFF 74.22%, #B0A5FF 98.46%)">
    <UsageTitle>Switch Chain</UsageTitle>
    <Description variant="body1">
      You can switch chain by click the button.
    </Description>
    <ChainSelect size="small" variant="standard" disableUnderline  value={chainId} onChange={handleChange} MenuProps={menuProps}
      inputProps={{ height: '55px'}}
    >
      {Items}
    </ChainSelect>
    <SwitchChainButton onClick={handleSwitchChain}>Switch Chain to {chainId}</SwitchChainButton>
  </UsageBox>
}