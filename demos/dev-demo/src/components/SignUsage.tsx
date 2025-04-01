import { Box, Grid, Input, Link, Snackbar, Stack, styled, Typography } from "@mui/material";
import { Button } from "./common";
import { useMemo, useState } from "react";
import SuccessIcon from "./SuccessIcon";
import ErrorIcon from "./ErrorIcon";
import { useWallet } from "./WalletProvider";
import { CHAIN_ID, TRONSCAN_URL } from "../config";
import { tronWeb } from "../tronweb";
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

export const UsageBox = styled(Box)(({ background } : { background: string }) => ({
  width: '280px',
  borderRadius: 10,
  background,
  padding: '15px 20px 15px 20px',
  marginLeft: '20px',
  boxSizing: 'border-box',
  flex: '1 0 auto',
  display: 'flex',
  flexDirection: 'column',

  "@media (max-width: 780px)": {
    width: '100%',
    marginLeft: '0px',
    marginTop: '20px'
  }
}));

export const UsageTitle = styled('h2')({
  fontFamily: 'Wix Madefor Display, sans-serif',
  fontWeight: 700,
  fontSize: '20px',
  lineHeight: '25px',
  color: '#fff',
  margin: '0'
});

const MessageInput = styled(Input)({
  width: '100%',
  height: '55px',
  borderRadius: '10px',
  backgroundColor: 'rgba(20, 18, 118, 0.7)',
  marginTop: '50px',
  marginBottom: '20px',
  padding: '0 20px',
  border: '1px solid transparent',
  transition: 'border-color 0.5s ease',
  '&.Mui-focused': {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  '& .MuiInput-input': {
    'caretColor': 'white',
    color: 'white',
  },

  '& .MuiInput-input::placeholder': {
    color: 'rgba(255, 255, 255, 0.5)',
    opacity: 1
  }
});

const InformAlert = styled(Snackbar)({
  padding: '10px',
  marginTop: '20px',
  border: '1px solid rgba(214, 217, 224, 1)',
  borderRadius: '10px',
  backgroundColor: 'rgba(255, 255, 255, 1)',
  minWidth: '320px',
  justifyContent: 'flex-start',
});

const InformAlertWrap = styled('div')({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
});
const InformAlertText = styled(Typography)({
  color: 'rgba(123, 124, 157, 1)'
});

// Replace with another address. Don't transfer any assets to this address.
const receiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';

export default function SignUsage() {
  const { connectionState, adapter } = useWallet();
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<'Transfer' | 'Sign Message' | 'Verify Message'>('Transfer');
  const onSignMessage = async () => {
    if (!adapter) {
      return;
    }
    const res = await adapter.signMessage(message);
    setSignature(res);
    setSuccess(true);
    setOpen(true);
    setTitle('Sign Message');
  }
  const onVerifySignedMessage = async () => {
    if (!adapter) {
      return;
    }
    const recoveredAddress = await tronWeb.trx.verifyMessageV2(message, signature);
    setSuccess(recoveredAddress === adapter.address);
    setOpen(true);
    setTitle('Verify Message');
  }
  const onTransfer = async () => {
    if (!adapter) {
      return;
    }
    const transaction = await tronWeb.transactionBuilder.sendTrx(receiver, tronWeb.toSun(0.000001) as unknown as number, adapter.address || '');
    const signedTransaction = await adapter.signTransaction(transaction);
    const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
    setSuccess(res.result);
    setOpen(true);
    setTitle('Transfer');
  }

  const InformAlertContent = useMemo(() => {
    if (title === 'Transfer') {
      return <InformAlertText>
        { success ? <>Success! You can confirm your transaction on <Link href={`${TRONSCAN_URL[connectionState.chainId] || TRONSCAN_URL[CHAIN_ID.Nile]}#/address/${connectionState.address}`} target="_blank" rel="noreferrer">TronScan</Link></> : 'Transfer failed'}
      </InformAlertText>
    }
    if (title === 'Sign Message') {
      return <InformAlertText>
        { success
          ? <>Success! The signature is <i>{signature.slice(0, 6)}...{signature.slice(-6)}</i></> : 'Failed to sign the message'}
      </InformAlertText>
    }
    if (title === 'Verify Message') {
      return <InformAlertText>
        {success ? 'Success! The signature is valid' : 'Failed to verify the signature'}
      </InformAlertText>
    }
  }, [title, success, signature, connectionState.chainId, connectionState.address]);
  return (
    <UsageBox background='linear-gradient(210deg, #CEA5BA -1.29%, #4643DF 21.87%, #4643DF 74.72%, #41B7E9 98.71%)'>
      <UsageTitle>Sign Usage</UsageTitle>
      <MessageInput placeholder="Message to sign" disableUnderline={true} value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button disabled={!connectionState.connected} onClick={onSignMessage} sx={{ marginBottom: '20px' }}>Sign Message</Button>
      <Button disabled={!connectionState.connected} onClick={onVerifySignedMessage} sx={{ marginBottom: '20px' }}>Verify Signed Message</Button>
      <Button disabled={!connectionState.connected} onClick={onTransfer}>Transfer</Button>
      <InformAlert open={open} autoHideDuration={6000} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <InformAlertWrap>
          {success ? <SuccessIcon /> : <ErrorIcon />}
          <div style={{ marginLeft: '10px', position: 'relative', flex: '1' }}>
            <Typography color="rgba(7, 9, 76, 1)">{title}</Typography>
            <CloseRoundedIcon color="action" style={{ position: 'absolute', top: '0', right: '0', cursor: 'pointer' }} onClick={() => setOpen(false)} />
            {InformAlertContent}
          </div>
        </InformAlertWrap>
      </InformAlert>
    </UsageBox >
  );
}