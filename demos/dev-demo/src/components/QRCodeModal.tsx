import { Dialog, DialogContent, DialogTitle, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  open: boolean;
  uri: string;
  onClose: () => void;
}

export default function QRCodeModal({ open, uri, onClose }: QRCodeModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Scan with Wallet
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2 }}>
          <QRCodeSVG
            value={uri}
            size={256}
            level="M"
            imageSettings={{
              src: 'https://walletadapter.org/logo.png',
              height: 40,
              width: 40,
              excavate: true,
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Scan this QR code with your WalletConnect-compatible wallet
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
