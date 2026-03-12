const { execSync } = require('child_process');
const pkg = require('../package.json');
const { exit } = require('process');
const branch = execSync('git branch --show-current').toString('utf-8').trim();
const [$0, _, branchVersion] = branch.match(/^(release|feature)\/v([\d.]+)/) || [];
if ($0 && branchVersion !== pkg.version) {
    console.error(
        `VersionCheckFail: Current branch version is ${branchVersion}, but the repo version is ${pkg.version}.`
    );
    exit(1);
}
