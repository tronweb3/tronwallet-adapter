import { colors, styled } from "@mui/material";
import MuiButton from "@mui/material/Button";

export const Button = styled(MuiButton)({
  height: '55px',
  lineHeight: '55px',
  color: '#fff',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.5s ease',
  margin: '0',
  '&:hover': {
    backgroundColor: '#fff',
    color: '#000',
  },
  '&.Mui-disabled': {
    color: '#fff',
  }
});