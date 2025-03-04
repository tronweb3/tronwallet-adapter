import styled from "@emotion/styled";
import type { SelectChangeEvent} from "@mui/material";
import { Box, Divider, MenuItem, Select, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useWallet } from "./WalletProvider";
import type { AdapterName } from "@tronweb3/tronwallet-abstract-adapter";

const SelectBox = styled(Box)({
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#e8e8ef',
  borderRadius: 10,
  padding: '0px 0px 0px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
  '& fieldset': { border: 'none' },
  '&:hover fieldset': { border: 'none' },
  '&.Mui-focused fieldset': { border: 'none' },
});

const MySelect = styled(Select)({
  width: '200px',
  border: 'none',
});
export default function AdapterSelect() {
  const { adapters, setSelectedAdapterName, selectedAdapterName } = useWallet();
  const Items = useMemo(
    () =>
      adapters.map((adapter) => (
        <MenuItem value={adapter.name} key={adapter.name}>
          <Stack direction="row" spacing={2} alignItems={'center'}>
            <img src={adapter.icon} alt={adapter.name} style={{ width: 24, height: 24, marginRight: 10 }} />
            {adapter.name}
          </Stack>
        </MenuItem>
      )),
    [adapters]
  );

  function handleChange(e: SelectChangeEvent<unknown>, child: React.ReactNode) {
    setSelectedAdapterName(e.target.value as AdapterName);
  }
  const menuProps = {
    PaperProps: {
      style: {
        backgroundColor: '#e8e8ef',
        borderRadius: '10px',
      },
    },
    MenuListProps: {
      sx: {
        '& .MuiMenuItem-root': {
          backgroundColor: '#e8e8ef',
          margin: '0 5px',
          borderRadius: '10px',
          lineHeight: '40px',
          transition: 'all 0.5s ease',
          '&:hover': {
            backgroundColor: '#c9c9da',
          },
          '&.Mui-selected': {
            backgroundColor: '#c9c9da',
          },
        },
      },
    },
  };
  return <SelectBox>
    <Typography sx={{ lineHeight: '60px', color: '#7b7c9d', flex: 1, fontWeight: 500, }}>Select the Adapter</Typography>
    <Divider orientation="vertical" sx={{ height: '20px' }}/>
    <MySelect size="small" value={selectedAdapterName} onChange={handleChange}  MenuProps={menuProps}>
      {Items}
    </MySelect>
  </SelectBox>
}