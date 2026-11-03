import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { configureGitHooks } from './setup-git-hooks.mjs';

const repositoryRoot = process.cwd();
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function shellAvailable() {
  return spawnSync('sh', ['-c', 'exit 0'], { stdio: 'ignore' }).status === 0;
}

function makeFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'git-hooks-'));
  temporaryDirectories.push(root);
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  const fakeBin = path.join(root, 'fake-bin');
  mkdirSync(fakeBin);
  const fakeNpm = path.join(fakeBin, 'npm');
  const fakeNpmCmd = path.join(fakeBin, 'npm.cmd');
  const script = '#!/bin/sh\nprintf "%s\\n" "$*" > "$HOOK_CAPTURE"\nexit "${HOOK_EXIT:-0}"\n';
  for (const file of [fakeNpm, fakeNpmCmd]) {
    writeFileSync(file, script, 'utf8');
    chmodSync(file, 0o755);
  }
  return { root, fakeBin, capture: path.join(root, 'capture.txt') };
}

function runHook(fixture, hookName, args = [], exitCode = '0') {
  const hook = path.join(repositoryRoot, '.githooks', hookName);
  return spawnSync('sh', [hook, ...args], {
    cwd: fixture.root,
    env: {
      ...process.env,
      PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      HOOK_CAPTURE: fixture.capture,
      HOOK_EXIT: exitCode,
    },
    encoding: 'utf8',
  });
}

describe('repository Git hook guards', () => {
  it('keeps explicit, fail-closed staged and pre-push commands', () => {
    const preCommit = readFileSync(path.join(repositoryRoot, '.githooks', 'pre-commit'), 'utf8');
    const prePush = readFileSync(path.join(repositoryRoot, '.githooks', 'pre-push'), 'utf8');
    const attributes = readFileSync(path.join(repositoryRoot, '.gitattributes'), 'utf8');
    expect(Buffer.from(preCommit).includes(0x0d)).toBe(false);
    expect(Buffer.from(prePush).includes(0x0d)).toBe(false);
    expect(attributes).toContain('/.githooks/* text eol=lf');
    expect(preCommit).toMatch(/set -eu/);
    expect(preCommit).toContain('check:privacy:staged');
    expect(prePush).toMatch(/set -eu/);
    expect(prePush).toMatch(/remote_name=\$\{1-\}/);
    expect(prePush).toContain('check:privacy:prepush');
    expect(prePush).toContain('--remote=$remote_name');
    const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
    expect(packageJson.scripts['hooks:setup']).toBe('node scripts/setup-git-hooks.mjs');
    expect(readFileSync(path.join(repositoryRoot, 'scripts', 'setup-git-hooks.mjs'), 'utf8')).toContain('core.hooksPath');
  });

  it('runs a copied executable hook with raw LF and configures a fixture repository idempotently', () => {
    if (!shellAvailable()) return;
    const fixture = makeFixture();
    const hookDirectory = path.join(fixture.root, '.githooks');
    mkdirSync(hookDirectory);
    const hookCopy = path.join(hookDirectory, 'pre-push');
    copyFileSync(path.join(repositoryRoot, '.githooks', 'pre-push'), hookCopy);
    chmodSync(hookCopy, 0o755);
    expect(readFileSync(hookCopy).includes(0x0d)).toBe(false);
    if (process.platform !== 'win32') {
      expect(statSync(hookCopy).mode & 0o111).not.toBe(0);
    }

    const runner = process.platform === 'win32' ? 'sh' : hookCopy;
    const runnerArgs = process.platform === 'win32' ? [hookCopy, 'origin'] : ['origin'];
    const result = spawnSync(runner, runnerArgs, {
      cwd: fixture.root,
      env: {
        ...process.env,
        PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
        HOOK_CAPTURE: fixture.capture,
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(readFileSync(fixture.capture, 'utf8')).toContain('--remote=origin');

    expect(configureGitHooks(fixture.root)).toBe('configured');
    expect(configureGitHooks(fixture.root)).toBe('already-configured');
    expect(execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
      cwd: fixture.root,
      encoding: 'utf8',
    }).trim()).toBe('.githooks');
  });

  it('forwards the remote name and propagates a missing-check failure when a POSIX shell is available', () => {
    if (!shellAvailable()) return;
    const fixture = makeFixture();
    const passed = runHook(fixture, 'pre-push', ['origin']);
    expect(passed.status).toBe(0);
    expect(readFileSync(fixture.capture, 'utf8')).toContain('--remote=origin');

    const failed = runHook(fixture, 'pre-push', ['origin'], '1');
    expect(failed.status).not.toBe(0);
  });

  it('rejects a pre-push invocation without a remote name', () => {
    if (!shellAvailable()) return;
    const fixture = makeFixture();
    const result = runHook(fixture, 'pre-push');
    expect(result.status).not.toBe(0);
  });
});
