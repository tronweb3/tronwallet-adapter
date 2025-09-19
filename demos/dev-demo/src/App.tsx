import { Box } from '@mui/material';

import AdapterBasicUsage from './AdapterBasicUsage.js';
import WalletProvider from './components/WalletProvider.js';
import { AdapterBasicTest } from './AdapterBasicTest.js';

function App() {
  return (
    <div className="App">
      <WalletProvider>
        <Box sx={{ width: '100%' }}>
          {/* <AdapterBasicUsage /> */}
          <AdapterBasicTest />
        </Box>
      </WalletProvider>
    </div>
  );
}

export default App;
