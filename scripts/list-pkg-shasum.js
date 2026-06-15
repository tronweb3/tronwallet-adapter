/**
 * List the name and shasum of packages to be published.
 *
 * Usage:
 *   node scripts/list-pkg-shasum.js             # only packages whose version differs from the registry
 *   node scripts/list-pkg-shasum.js --all        # every non-private package regardless of version
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALL_MODE = process.argv.includes('--all');

const DIRS = [
    path.resolve(__dirname, '../packages/adapters'),
    path.resolve(__dirname, '../packages/adapters/evm'),
    path.resolve(__dirname, '../packages/react'),
    path.resolve(__dirname, '../packages/vue'),
];

// ── Step 1: collect all non-private packages ──────────────────────────────────

const packages = [];
const versionMap = {}; // name -> version, for every workspace package (incl. private)
const allPkgPaths = []; // every top-level package.json under packages/, for the workspace rewrite

DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
        .filter((entry) => !entry.startsWith('.') && entry !== 'evm')
        .forEach((entry) => {
            const pkgPath = path.resolve(dir, entry, 'package.json');
            if (!fs.existsSync(pkgPath)) return;
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                versionMap[pkg.name] = pkg.version;
                allPkgPaths.push(pkgPath);
                if (pkg.private) return;
                packages.push({ name: pkg.name, version: pkg.version, dir: path.resolve(dir, entry) });
            } catch {
                // skip malformed package.json
            }
        });
});

// ── Step 2: filter to updated packages when not in --all mode ─────────────────

function getRegistryVersion(name) {
    try {
        return execFileSync('npm', ['view', name, 'version'], { stdio: 'pipe' }).toString().trim();
    } catch (e) {
        if (e.toString().includes('E404')) return null; // never published
        throw e;
    }
}

const selected = [];

packages.forEach(({ name, version, dir }) => {
    if (ALL_MODE) {
        selected.push({ name, version, dir });
        return;
    }
    process.stdout.write(`Checking ${name}… `);
    const registryVersion = getRegistryVersion(name);
    if (registryVersion === version) {
        console.log(`same (${version}), skipping`);
    } else {
        console.log(`${registryVersion ?? 'not published'} → ${version}, including`);
        selected.push({ name, version, dir });
    }
});

// ── Step 3: temporarily replace the workspace: protocol with concrete versions ─
//
// `npm pack` does not understand pnpm's `workspace:` protocol and would otherwise
// leave `workspace:^` literally in the packed package.json. To get a shasum that
// reflects real, resolved dependency versions we rewrite every package.json under
// packages/ in place, pack, then restore the originals byte-for-byte (Step 5).
//
// The ^ / ~ prefix is preserved:
//   workspace:^      -> ^<version>
//   workspace:~      -> ~<version>
//   workspace:*      -> <version>   (exact)
//   workspace:       -> <version>   (exact, no range)
//   workspace:^1.2.3 -> ^1.2.3      (explicit range kept as-is)

const DEP_SPEC_RE = /("([^"]+)"\s*:\s*")workspace:([^"]*)(")/g;
const backups = new Map(); // pkgPath -> original file content

function resolveWorkspace(depName, rest) {
    const v = versionMap[depName];
    if (v === undefined) {
        console.warn(`  ! cannot resolve "${depName}"; leaving workspace:${rest} as-is`);
        return `workspace:${rest}`;
    }
    if (rest === '' || rest === '*') return v;
    if (rest === '^') return `^${v}`;
    if (rest === '~') return `~${v}`;
    return rest; // already an explicit range, e.g. ^1.2.3
}

function rewriteWorkspaceDeps() {
    allPkgPaths.forEach((pkgPath) => {
        const original = fs.readFileSync(pkgPath, 'utf8');
        let changed = false;
        const updated = original.replace(DEP_SPEC_RE, (_m, prefix, depName, rest, suffix) => {
            const resolved = resolveWorkspace(depName, rest);
            if (resolved !== `workspace:${rest}`) changed = true;
            return `${prefix}${resolved}${suffix}`;
        });
        if (changed) {
            backups.set(pkgPath, original);
            fs.writeFileSync(pkgPath, updated);
        }
    });
}

function restoreWorkspaceDeps() {
    backups.forEach((original, pkgPath) => fs.writeFileSync(pkgPath, original));
    backups.clear();
}

// Always restore the originals, even on Ctrl-C.
['SIGINT', 'SIGTERM'].forEach((sig) =>
    process.on(sig, () => {
        restoreWorkspaceDeps();
        process.exit(1);
    })
);

// ── Step 4: compute shasum for selected packages via `npm pack --dry-run` ──────

function getShasum(dir) {
    try {
        const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
            cwd: dir,
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: 64 * 1024 * 1024,
        }).toString();
        return JSON.parse(out)[0].shasum;
    } catch {
        return '(error)';
    }
}

console.log(`\n${ALL_MODE ? 'All' : 'Updated'} packages (${selected.length}):\n`);

console.log('Replacing workspace: protocol with concrete versions…');
rewriteWorkspaceDeps();
console.log(`Rewrote ${backups.size} package.json file(s).\n`);

const rows = [];
try {
    selected.forEach(({ name, version, dir }) => {
        process.stdout.write(`Packing ${name}… `);
        const shasum = getShasum(dir);
        console.log('done');
        rows.push({ name, version, shasum });
    });
} finally {
    // ── Step 5: restore every package.json we touched ─────────────────────────
    restoreWorkspaceDeps();
    console.log('\nRestored all package.json files.');
}

// ── Step 6: print result table ────────────────────────────────────────────────

if (rows.length === 0) {
    console.log('No packages to publish.');
    process.exit(0);
}

const colName = Math.max('Package'.length, ...rows.map((r) => r.name.length));
const colVer = Math.max('Version'.length, ...rows.map((r) => r.version.length));
const colHash = Math.max('Shasum'.length, ...rows.map((r) => r.shasum.length));
const sep = `+-${'-'.repeat(colName)}-+-${'-'.repeat(colVer)}-+-${'-'.repeat(colHash)}-+`;

console.log('\n' + sep);
console.log(`| ${'Package'.padEnd(colName)} | ${'Version'.padEnd(colVer)} | ${'Shasum'.padEnd(colHash)} |`);
console.log(sep);
rows.forEach(({ name, version, shasum }) => {
    console.log(`| ${name.padEnd(colName)} | ${version.padEnd(colVer)} | ${shasum.padEnd(colHash)} |`);
});
console.log(sep);
