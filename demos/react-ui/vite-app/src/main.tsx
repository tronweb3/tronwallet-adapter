import * as React from 'react';
import ReactDOM from 'react-dom/client';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { App } from './App';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import vConsole from 'vconsole';
new vConsole();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <App></App>
            <Toaster />
        </ThemeProvider>
    </React.StrictMode>
);
