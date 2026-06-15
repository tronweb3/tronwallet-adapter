import * as React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider theme={theme}>
    <App />
  </ThemeProvider>
);
