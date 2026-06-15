import React, { useState, useRef, useEffect } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import * as AllAdapters from '@tronweb3/tronwallet-adapters';
import { AddonAdapter } from '@tronweb3/tronwallet-abstract-adapter';
import type { Adapter } from '@tronweb3/tronwallet-abstract-adapter';
import { walletconnectConfig } from './config';

// ── Inline types (SecurityOptions not yet re-exported from abstract-adapter) ─

type RiskItem = { title: string; noticeType: 1 | 2 | 3 };

interface SecurityOptions {
  enabled?: boolean;
  configUrls?: string[];
  onRiskDetected?: (result: { risks: RiskItem[] }) => Promise<void>;
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
}

// ── Adapter factory ───────────────────────────────────────────────────────────
//
// Dynamically filter adapters that extend AddonAdapter and build the adapter list.
// `adapterName` must match the exact key used in the security config JSON
// (i.e. result.wallets[adapterName]). Individual adapter configs don't yet
// expose securityOptions in their TS interfaces (shipping in v1.2.27),
// so cast to `any` for now.

const ADAPTERS = Object.entries(AllAdapters)
  .filter(([, Ctor]) => typeof Ctor === 'function' && Ctor.prototype instanceof AddonAdapter)
  .map(([, Ctor]) => {
    const instance = new (Ctor as any)({}) as Adapter;
    const name = instance.name || 'Unknown';

    if (name === 'Binance Wallet') {
      return {
        label: name,
        adapterName: name,
        create: (o: SecurityOptions) =>
          new (Ctor as typeof AllAdapters.BinanceWalletAdapter)({ securityOptions: o, useWalletConnectWhenWalletNotFound: true, walletConnectConfig: walletconnectConfig }) as Adapter,
      };
    }
    return {
      label: name,
      adapterName: name,
      create: (o: SecurityOptions) => new (Ctor as any)({ securityOptions: o } as any) as Adapter,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

// ── Local mock config files served by the Vite dev-server plugin ─────────────
//
// See vite.config.ts → mockSecurityConfigPlugin and the *.json files in this directory.
// Copy a URL from here and paste it into the configUrls field below.

const MOCK_CONFIGS = [
  { label: 'All wallets blocked', path: '/mock-security-config.json' },
  { label: 'Partial — TronLink + MetaMask', path: '/mock-security-config-partial.json' },
];

// ── Demo config model ────────────────────────────────────────────────────────
//
// Holds the editable form state. Mirrors SecurityOptions plus the demo-only
// `throwOnRisk` field (not part of SecurityOptions):
//   true  → onRiskDetected throws and blocks connect
//   false → onRiskDetected logs a warning but allows connect

interface DemoConfig {
  enabled: boolean;
  configUrls: string[];
  throwOnRisk: boolean;
  timeout: number;
  retries: number;
  cacheTTL: number;
}

const DEFAULT_CONFIG: DemoConfig = {
  enabled: true,
  configUrls: [`${window.location.origin}/mock-security-config.json`],
  throwOnRisk: false,
  timeout: 2000,
  retries: 0,
  cacheTTL: 30000,
};

// ── Styled helpers ────────────────────────────────────────────────────────────

const PageTitle = styled(Typography)({
  fontFamily: 'Wix Madefor Display, sans-serif',
  fontSize: '36px',
  fontWeight: 800,
  textAlign: 'center',
  color: 'rgba(7, 9, 76, 1)',
  marginBottom: '8px',
});

const SectionCard = styled(Paper)({
  padding: '20px 24px',
  borderRadius: '12px',
  backgroundColor: '#e8e8ef',
  marginBottom: '16px',
  boxShadow: 'none',
});

const SectionTitle = styled(Typography)({
  fontWeight: 700,
  color: '#07094c',
  marginBottom: '12px',
});

const ConnectButton = styled(Button)({
  width: '100%',
  lineHeight: '60px',
  backgroundColor: '#000000',
  color: '#fff',
  borderRadius: '10px',
  fontSize: '16px',
  fontWeight: 700,
  padding: 0,
  '&:hover': { backgroundColor: '#07094c' },
  '&.Mui-disabled': { color: '#fff', backgroundColor: '#555' },
});

const MonoBox = styled(Box)({
  backgroundColor: '#1a1a2e',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#c0c0c0',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
});

// ── Log ───────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error' | 'success';
type LogEntry = { time: string; level: LogLevel; message: string };

const LOG_COLORS: Record<LogLevel, string> = {
  info: '#c0c0c0',
  warn: '#ffd93d',
  error: '#ff6b6b',
  success: '#6bcb77',
};

// ── Field components ──────────────────────────────────────────────────────────
//
// The securityOptions editor is split into one small input per field so it works
// well on mobile: booleans → checkbox, numbers → numeric input, configUrls →
// multiline text (one URL per line).

function BooleanField({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      sx={{ alignItems: 'flex-start', m: 0 }}
      control={<Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} sx={{ pt: 0 }} />}
      label={
        <Box>
          <Typography component="span" fontSize={14} fontWeight={600} color="#07094c" fontFamily="monospace">
            {label}
          </Typography>
          <Typography fontSize={12} color="#7b7c9d">
            {hint}
          </Typography>
        </Box>
      }
    />
  );
}

function NumberField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <TextField
      type="number"
      size="small"
      fullWidth
      label={label}
      helperText={hint}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      sx={{ '& .MuiInputBase-root': { backgroundColor: '#fff', borderRadius: '8px', fontFamily: 'monospace', fontSize: 13 } }}
    />
  );
}

function UrlsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Box>
      <Typography fontSize={14} fontWeight={600} color="#07094c" fontFamily="monospace">
        configUrls
      </Typography>
      <Typography fontSize={12} color="#7b7c9d" mb={0.5}>
        Remote security config URLs — one per line.
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        sx={{ '& .MuiInputBase-root': { backgroundColor: '#fff', borderRadius: '8px', fontFamily: 'monospace', fontSize: 13, alignItems: 'flex-start' } }}
      />
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ConnectStatus = 'idle' | 'connecting' | 'success' | 'error';

export default function SecurityDemo() {
  const [adapterIdx, setAdapterIdx] = useState(() => {
    const saved = localStorage.getItem('securityDemo.adapterIdx');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [config, setConfig] = useState<DemoConfig>(() => {
    const saved = localStorage.getItem('securityDemo.config');
    if (saved) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        // ignore corrupt storage — fall back to defaults
      }
    }
    return DEFAULT_CONFIG;
  });
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const adapterRef = useRef<Adapter | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Initialize the adapter as soon as the page loads (and whenever the selected
  // wallet changes) so we can read its `connected` state and subscribe to
  // connect/disconnect events without waiting for the user to click Connect.
  useEffect(() => {
    const adapterDef = ADAPTERS[adapterIdx];
    let adapter: Adapter;
    try {
      adapter = adapterDef.create(buildOptions() ?? {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog('error', `Adapter construction failed: ${msg}`);
      return;
    }

    adapterRef.current = adapter;
    adapter.on('connect', (addr: string) => {
      addLog('success', `connect event — address: ${addr}`);
      setConnected(true);
      setStatus('success');
      setAddress(addr);
    });
    adapter.on('disconnect', () => {
      addLog('info', 'disconnect event');
      setConnected(false);
      setStatus('idle');
      setAddress('');
    });

    // Read the current connection state up front — the adapter may already be
    // connected (e.g. the wallet auto-reconnected) before any event fires.
    setConnected(adapter.connected);
    setStatus(adapter.connected ? 'success' : 'idle');
    setAddress(adapter.connected ? adapter.address || '' : '');
    addLog('info', `Initialized ${adapterDef.label} adapter (connected=${adapter.connected})`);

    return () => {
      adapter.removeAllListeners();
    };
    // buildOptions reads the latest config; we intentionally only recreate the
    // adapter when the selected wallet changes — config edits are pushed via
    // updateSecurityOptions in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterIdx]);

  // Push security-option edits into the live adapter without recreating it.
  // Skip the initial run — the adapter was just built with these options above.
  const didInitOptions = useRef(false);
  useEffect(() => {
    if (!didInitOptions.current) {
      didInitOptions.current = true;
      return;
    }
    const adapter = adapterRef.current;
    if (!(adapter instanceof AddonAdapter)) return;
    const options = buildOptions();
    try {
      adapter.updateSecurityOptions(options);
      addLog('info', `Security options updated (enabled=${options.enabled ?? false})`);
    } catch (e: unknown) {
      addLog('error', `updateSecurityOptions failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  function addLog(level: LogLevel, message: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog((prev) => [...prev, { time, level, message }]);
  }

  function updateConfig<K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('securityDemo.config', JSON.stringify(next));
      return next;
    });
  }

  function buildOptions(): SecurityOptions {
    const { throwOnRisk, configUrls, ...rest } = config;
    const options: SecurityOptions = {
      ...rest,
      configUrls: configUrls.map((u) => u.trim()).filter(Boolean),
    };

    if (options.enabled) {
      options.onRiskDetected = throwOnRisk
        ? async (result) => {
            const titles = result.risks.map((r) => r.title).join(', ');
            addLog('error', `onRiskDetected — blocking connect. Risks: ${titles}`);
            throw new Error(`[WalletAdapter] Security risk detected: ${titles}`);
          }
        : async (result) => {
            const titles = result.risks.map((r) => r.title).join(', ');
            addLog('warn', `onRiskDetected — log only (not blocking). Risks: ${titles}`);
          };
    }

    return options;
  }

  async function handleConnect() {
    const adapter = adapterRef.current;
    if (!adapter) return;

    setStatus('connecting');
    setErrorMsg('');
    addLog('info', 'Calling adapter.connect()…');

    try {
      await adapter.connect();
      setStatus('success');
      setConnected(true);
      setAddress(adapter.address || '');
      addLog('success', `Connected! address=${adapter.address}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog('error', `connect() threw: ${msg}`);
      setStatus('error');
      setErrorMsg(msg);
    }
  }

  async function handleDisconnect() {
    try {
      await adapterRef.current?.disconnect();
    } catch (e: unknown) {
      addLog('error', `disconnect() threw: ${e instanceof Error ? e.message : String(e)}`);
    }
    setStatus('idle');
    setConnected(false);
    setAddress('');
    addLog('info', 'Disconnected');
  }

  const isConnected = connected;
  const isConnecting = status === 'connecting';

  return (
    <Box sx={{ pt: '40px', pb: '60px', maxWidth: '980px', mx: 'auto', px: 2 }}>
      <PageTitle>Security Policy Demo</PageTitle>
      <Typography sx={{ textAlign: 'center', color: '#7b7c9d', mb: 3, fontFamily: 'Wix Madefor Display, sans-serif' }}>
        Edit the <code>securityOptions</code> below and click Connect to observe adapter behaviour.
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
        {/* ── Left: config ──────────────────────────────────────────── */}
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Mock config URL hints */}
          <SectionCard>
            <SectionTitle variant="subtitle1">Local Mock Config URLs</SectionTitle>
            <Typography fontSize={13} color="#7b7c9d" mb={1.5}>
              These files are served by the Vite dev server. Copy a URL into the <code>configUrls</code> field below. Append query parameters to simulate slow or failing responses:
              <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5, '& li': { mb: 0.25 } }}>
                <li>
                  <code>?delay=3000</code> — wait 3 s before responding (test <code>timeout</code> / <code>retries</code>)
                </li>
                <li>
                  <code>?status=500</code> — return HTTP 500 (test error fallback)
                </li>
              </Box>
            </Typography>
            <Stack spacing={1}>
              {MOCK_CONFIGS.map(({ label, path }) => {
                const url = `${window.location.origin}${path}`;
                return (
                  <Box key={path}>
                    <Typography fontSize={12} fontWeight={600} color="#07094c">
                      {label}
                    </Typography>
                    <Box
                      component="code"
                      sx={{
                        display: 'block',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: '#444',
                        backgroundColor: '#d8d8e8',
                        borderRadius: '6px',
                        px: 1,
                        py: 0.5,
                        mt: 0.25,
                        wordBreak: 'break-all',
                        cursor: 'text',
                        userSelect: 'all',
                      }}
                    >
                      {url}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </SectionCard>

          {/* securityOptions editor */}
          <SectionCard>
            <SectionTitle variant="subtitle1">securityOptions</SectionTitle>
            <Stack spacing={2}>
              <BooleanField label="enabled" hint="Turn the remote security check on or off." checked={config.enabled} onChange={(v) => updateConfig('enabled', v)} />
              <BooleanField
                label="throwOnRisk"
                hint="When a risk is detected: checked → throw and block connect; unchecked → log only."
                checked={config.throwOnRisk}
                onChange={(v) => updateConfig('throwOnRisk', v)}
              />
              <UrlsField value={config.configUrls} onChange={(v) => updateConfig('configUrls', v)} />
              <NumberField label="timeout (ms)" hint="Per-request timeout when fetching configUrls." value={config.timeout} onChange={(v) => updateConfig('timeout', v)} />
              <NumberField label="retries" hint="Number of retries on a failed fetch." value={config.retries} onChange={(v) => updateConfig('retries', v)} />
              <NumberField label="cacheTTL (ms)" hint="How long a fetched config is cached." value={config.cacheTTL} onChange={(v) => updateConfig('cacheTTL', v)} />
            </Stack>
          </SectionCard>

          {/* Adapter selector */}
          <SectionCard>
            <SectionTitle variant="subtitle1">Wallet Adapter</SectionTitle>
            <FormControl fullWidth size="small">
              <Select
                value={adapterIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setAdapterIdx(idx);
                  localStorage.setItem('securityDemo.adapterIdx', String(idx));
                }}
                sx={{ backgroundColor: '#fff', borderRadius: '8px', '& fieldset': { border: 'none' } }}
              >
                {ADAPTERS.map((a, i) => (
                  <MenuItem key={a.label} value={i}>
                    {a.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography fontSize={12} color="#7b7c9d" sx={{ mt: 0.5 }}>
              Security config key:{' '}
              <Box component="code" sx={{ backgroundColor: '#d8d8e8', borderRadius: '4px', px: 0.5, fontFamily: 'monospace', color: '#07094c' }}>
                {ADAPTERS[adapterIdx].adapterName}
              </Box>
            </Typography>
          </SectionCard>

          <ConnectButton onClick={isConnected ? handleDisconnect : handleConnect} disabled={isConnecting}>
            {isConnecting ? (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" height="100%">
                <CircularProgress size={18} sx={{ color: '#fff' }} />
                <span>Connecting…</span>
              </Stack>
            ) : isConnected ? (
              'Disconnect'
            ) : (
              'Connect'
            )}
          </ConnectButton>
        </Box>

        {/* ── Right: result + log ────────────────────────────────────── */}
        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Connection result */}
          <SectionCard>
            <SectionTitle variant="subtitle1">Connection Result</SectionTitle>
            {status === 'idle' && (
              <Typography color="#7b7c9d" fontSize={14}>
                Not connected. Edit the options and click Connect.
              </Typography>
            )}
            {status === 'connecting' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography fontSize={14}>Connecting…</Typography>
              </Stack>
            )}
            {status === 'success' && (
              <Alert severity="success" sx={{ borderRadius: '8px' }}>
                <Typography fontWeight={700}>Connected</Typography>
                <Typography fontSize={13} sx={{ wordBreak: 'break-all', mt: 0.5, fontFamily: 'monospace' }}>
                  {address}
                </Typography>
              </Alert>
            )}
            {status === 'error' && (
              <Alert severity="error" sx={{ borderRadius: '8px' }}>
                <Typography fontWeight={700}>Connection Failed</Typography>
                <Typography fontSize={12} sx={{ wordBreak: 'break-all', mt: 0.5, fontFamily: 'monospace' }}>
                  {errorMsg}
                </Typography>
              </Alert>
            )}
          </SectionCard>

          {/* Event log */}
          <SectionCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <SectionTitle variant="subtitle1" sx={{ mb: 0 }}>
                Event Log
              </SectionTitle>
              <Button size="small" onClick={() => setLog([])} sx={{ color: '#7b7c9d', textTransform: 'none', minWidth: 0 }}>
                Clear
              </Button>
            </Stack>
            <MonoBox sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {log.length === 0 && <span style={{ color: '#555' }}>Events will appear here after you click Connect.</span>}
              {log.map((entry, i) => (
                <div key={i}>
                  <span style={{ color: '#666' }}>[{entry.time}] </span>
                  <span style={{ color: LOG_COLORS[entry.level] }}>{entry.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </MonoBox>
          </SectionCard>
        </Box>
      </Stack>
    </Box>
  );
}
