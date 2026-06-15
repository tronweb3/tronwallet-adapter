const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const e2eDir = join(root, 'e2e');
const repoUrl = 'https://github.com/tronweb3/tronwallet-adapter-e2e.git';
// nvm is a shell function, must be sourced before use
const installCmd = `pnpm i && pnpm build`;

if (existsSync(join(e2eDir, '.git'))) {
    console.log('[sync-e2e] Pulling latest e2e repo...');
    execSync('git pull', { cwd: e2eDir, stdio: 'inherit' });
} else {
    console.log('[sync-e2e] Cloning e2e repo...');
    execSync(`git clone ${repoUrl} e2e`, { cwd: root, stdio: 'inherit' });
}

console.log('[sync-e2e] Installing e2e dependencies...');
execSync(installCmd, { cwd: e2eDir, stdio: 'inherit', shell: '/bin/bash' });
