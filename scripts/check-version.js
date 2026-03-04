/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const { execSync } = require('child_process');
const path = require('path');

const exec = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function sanitizeRef(ref) {
    // Allow only safe characters for a git ref.
    if (!/^[a-zA-Z0-9_./-]+$/.test(ref)) {
        throw new Error(`Invalid BASE_REF provided: ${ref}`);
    }
    return ref;
}

function getWorkspacePackages() {
    try {
        const output = exec('pnpm m ls --json --depth=1');
        return JSON.parse(output);
    } catch (e) {
        console.error('Failed to get workspace packages:', e);
        process.exit(1);
    }
}

function getChangedFiles(baseRef) {
    try {
        const sanitizedRef = sanitizeRef(baseRef);
        const output = exec(`git diff --name-only ${sanitizedRef}...HEAD`);
        return output
            .split('\n')
            .filter(Boolean)
            .map((f) => path.resolve(process.cwd(), f));
    } catch (e) {
        console.error('Failed to get changed files:', e);
        process.exit(1);
    }
}

function getNpmVersion(pkgName) {
    // Sanitize pkgName to prevent command injection.
    // A valid npm package name can be scoped or unscoped.
    // It should only contain alphanumeric characters, dots, underscores, and hyphens.
    const validPackageNameRegex = /^(@[a-zA-Z0-9-._]+\/)?[a-zA-Z0-9-._]+$/;
    if (!validPackageNameRegex.test(pkgName)) {
        throw new Error(`Invalid or potentially malicious package name detected: ${pkgName}`);
    }
    try {
        return exec(`npm view ${pkgName} version`);
    } catch (e) {
        return null;
    }
}

function main() {
    const baseRef = process.env.BASE_REF;
    if (!baseRef) {
        console.error('BASE_REF environment variable is not set.');
        process.exit(1);
    }

    console.log(`Checking changes against ${baseRef}...`);

    const packages = getWorkspacePackages();
    const packageMap = new Map();
    packages.forEach((pkg) => packageMap.set(pkg.name, pkg));

    const changedFiles = getChangedFiles(baseRef);
    const changedPackages = new Set();

    changedFiles.forEach((file) => {
        for (const pkg of packages) {
            const srcDir = path.join(pkg.path, 'src');
            if (file.startsWith(srcDir)) {
                changedPackages.add(pkg.name);
            }
        }
    });

    let hasNewChanges = true;
    while (hasNewChanges) {
        hasNewChanges = false;
        for (const pkg of packages) {
            if (changedPackages.has(pkg.name)) continue;

            const deps = Object.keys(pkg.dependencies || {});
            const hasChangedDep = deps.some((dep) => packageMap.has(dep) && changedPackages.has(dep));

            if (hasChangedDep) {
                changedPackages.add(pkg.name);
                hasNewChanges = true;
            }
        }
    }

    const errors = [];
    changedPackages.forEach((pkgName) => {
        const pkg = packageMap.get(pkgName);
        const npmVersion = getNpmVersion(pkgName);

        if (npmVersion && npmVersion === pkg.version) {
            errors.push(
                `Package ${pkgName} (v${pkg.version}) has changes (or dependency changes) but version matches npm.`
            );
        }
    });

    if (errors.length > 0) {
        console.error('Version check failed:');
        errors.forEach((err) => console.error(`- ${err}`));
        process.exit(1);
    } else {
        console.log('All checks passed.');
    }
}

main();
