import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditPrivacy, scanBytes, scanFileName, scanText } from './check-privacy.mjs';

const temporaryDirectories = [];
const repositoryIdentityEmail = `301382510+65terb@${['users', 'noreply', 'github', 'com'].join('.')}`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempRepository(prefix = 'privacy-') {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: directory });
  execFileSync('git', ['config', 'user.name', 'Privacy Fixture'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', repositoryIdentityEmail], { cwd: directory });
  return directory;
}

function git(directory, args) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
}

function commitAll(directory, message = 'fixture') {
  git(directory, ['add', '-A']);
  git(directory, ['commit', '-qm', message]);
}

describe('repository privacy scan', () => {
  it('rejects local paths, temp/worktree paths, UNC paths, and high-confidence credentials', () => {
    const slash = String.fromCharCode(92);
    const windowsUserPath = ['C:', 'Users', 'someone', 'private.png'].join(slash);
    const windowsTempPath = ['C:', 'Temp', 'secret.txt'].join(slash);
    const unixHomePath = ['', 'home', 'someone', 'private.txt'].join('/');
    const unixTempPath = ['', 'tmp', 'cache'].join('/');
    const uncPath = `${slash}${slash}${['server', 'share', 'private.txt'].join(slash)}`;
    const worktreePath = ['C:', 'Users', '65ter', '.codex', 'worktrees', '4711'].join(slash);
    expect(scanText(windowsUserPath, 'docs/DECISIONS.md')).toHaveLength(1);
    expect(scanText(windowsTempPath, 'fixture.txt')).toHaveLength(1);
    expect(scanText(`${unixHomePath} ${unixTempPath}`, 'fixture.txt')).toHaveLength(2);
    expect(scanText(uncPath, 'fixture.txt')).toHaveLength(1);
    expect(scanText(worktreePath, 'fixture.txt')).toHaveLength(2);

    const token = 'ghp_' + 'x'.repeat(28);
    expect(scanText(`token=${token}`, 'notes.txt')).toHaveLength(1);
    const privateKey = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
    expect(scanText(privateKey, 'private.txt')).toHaveLength(1);
  });

  it('allows placeholders and .env.example only when its content is safe', () => {
    expect(scanFileName('.env.example')).toEqual([]);
    expect(scanText('API_KEY=YOUR_API_KEY\nTOKEN=<set-locally>', '.env.example')).toEqual([]);
    expect(scanText('API_KEY=ghp_' + 'x'.repeat(28), '.env.example')).toHaveLength(1);
    expect(scanText('Kenney Food Kit / loaf-round.glb', 'public/assets/license.txt')).toEqual([]);
  });

  it('does not blanket-exempt protected log filenames', () => {
    expect(scanFileName('docs/CODEX_COLLAB_LOG.md')).toEqual([]);
    expect(scanFileName('docs/REVIEW_LOG.md')).toEqual([]);
    expect(scanFileName('docs/PLAYTEST_LOG.md')).toEqual([]);
    expect(scanFileName('.env')).toHaveLength(1);
    expect(scanFileName('id_rsa')).toHaveLength(1);
    expect(scanFileName('credentials.json')).toHaveLength(1);
    expect(scanFileName('id_rsa.pem')).toHaveLength(1);
  });

  it('rejects newly covered high-confidence tokens in UTF-16 little- and big-endian text', () => {
    const secretText = [
      'xoxb-' + 'a'.repeat(18),
      'sk_live_' + 'b'.repeat(24),
      '_authToken=' + 'c'.repeat(24),
      'Bearer ' + 'd'.repeat(32),
    ].join('\n');
    const littleEndian = Buffer.from(`\ufeff${secretText}`, 'utf16le');
    const littleFindings = scanBytes(littleEndian, 'fixture.txt');
    expect(littleFindings.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'slack-token',
      'stripe-live-key',
      'npm-auth-token',
      'bearer-token',
    ]));

    const littleWithBom = Buffer.from(`\ufeff${secretText}`, 'utf16le');
    const bigEndian = Buffer.alloc(littleWithBom.length);
    for (let index = 0; index < littleWithBom.length; index += 2) {
      bigEndian[index] = littleWithBom[index + 1];
      bigEndian[index + 1] = littleWithBom[index];
    }
    const bigFindings = scanBytes(bigEndian, 'fixture.txt');
    expect(bigFindings.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'slack-token',
      'stripe-live-key',
      'npm-auth-token',
      'bearer-token',
    ]));
  });

  it('detects bounded no-BOM UTF-16 after non-ASCII prefixes and ignores truncated binary-like data', () => {
    const secretText = [
      '\u00e9-prefix',
      'xoxp-' + 'a'.repeat(18),
      'sk_live_' + 'b'.repeat(24),
      '_authToken=' + 'c'.repeat(24),
      'Bearer ' + 'd'.repeat(32),
    ].join('\n');
    const littleEndian = Buffer.from(secretText, 'utf16le');
    const bigEndian = Buffer.alloc(littleEndian.length);
    for (let index = 0; index < littleEndian.length; index += 2) {
      bigEndian[index] = littleEndian[index + 1];
      bigEndian[index + 1] = littleEndian[index];
    }
    expect(scanBytes(littleEndian, 'no-bom-le.txt').map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'slack-token',
      'stripe-live-key',
      'npm-auth-token',
      'bearer-token',
    ]));
    expect(scanBytes(bigEndian, 'no-bom-be.txt').map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'slack-token',
      'stripe-live-key',
      'npm-auth-token',
      'bearer-token',
    ]));

    const truncated = Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00]);
    expect(scanBytes(truncated, 'truncated.bin')).toEqual([]);
    const glb = readFileSync('public/assets/objects/stage1-wheat-token/wheat-token-v010-color-a-v001.glb');
    expect(scanBytes(glb, 'wheat-token-v010-color-a-v001.glb')).toEqual([]);
  });
});

describe('Git boundary privacy scopes', () => {
  it('scans the exact working candidate set and reports existing protected-log metadata without exempting it', () => {
    const repository = tempRepository();
    mkdirSync(path.join(repository, 'docs'), { recursive: true });
    writeFileSync(path.join(repository, 'tracked.txt'), 'safe');
    writeFileSync(path.join(repository, '.gitignore'), 'ignored.txt\n');
    commitAll(repository);
    writeFileSync(path.join(repository, 'nested.txt'), 'safe untracked');
    writeFileSync(path.join(repository, 'ignored.txt'), 'ghp_' + 'x'.repeat(28));
    const slash = String.fromCharCode(92);
    writeFileSync(path.join(repository, 'docs', 'REVIEW_LOG.md'), ['C:', 'Users', 'historical', 'review.md'].join(slash));

    const report = auditPrivacy(repository, { mode: 'working' });
    expect(report.candidateCount).toBeGreaterThanOrEqual(4);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'absolute-windows-user-path', filePath: 'docs/REVIEW_LOG.md', severity: 'report' }),
    ]));
    expect(report.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'ignored.txt' }),
    ]));
  });

  it('scans staged content including a protected log, forced credential files, and staged symlinks', () => {
    const repository = tempRepository();
    mkdirSync(path.join(repository, 'docs'), { recursive: true });
    const slash = String.fromCharCode(92);
    writeFileSync(path.join(repository, 'docs', 'REVIEW_LOG.md'), ['C:', 'Users', 'staged', 'review.md'].join(slash));
    writeFileSync(path.join(repository, '.env'), 'TOKEN=placeholder');
    git(repository, ['add', 'docs/REVIEW_LOG.md']);
    git(repository, ['add', '-f', '.env']);
    const report = auditPrivacy(repository, { mode: 'staged' });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'absolute-windows-user-path', filePath: 'docs/REVIEW_LOG.md', severity: 'error' }),
      expect.objectContaining({ kind: 'forbidden-filename', filePath: '.env', severity: 'error' }),
    ]));

    try {
      symlinkSync(path.join(repository, 'outside.txt'), path.join(repository, 'link.txt'));
      writeFileSync(path.join(repository, 'outside.txt'), 'safe');
      git(repository, ['add', 'link.txt']);
      const symlinkReport = auditPrivacy(repository, { mode: 'staged' });
      expect(symlinkReport.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'staged-symlink', filePath: 'link.txt' }),
      ]));
    } catch (error) {
      expect(['EPERM', 'EACCES']).toContain(error?.code);
    }
  });

  it('audits an empty remote push scope, enforces repository identity, and rejects history-only secrets', { timeout: 15_000 }, () => {
    const repository = tempRepository('privacy-history-');
    const remote = mkdtempSync(path.join(os.tmpdir(), 'privacy-remote-'));
    temporaryDirectories.push(remote);
    execFileSync('git', ['init', '--bare', '-q'], { cwd: remote });
    git(repository, ['remote', 'add', 'origin', remote]);
    writeFileSync(path.join(repository, 'safe.txt'), 'safe');
    commitAll(repository, 'safe history');
    const report = auditPrivacy(repository, { mode: 'first-push', remote: 'origin' });
    expect(report.remoteState).toBe('empty');
    expect(report.commitCount).toBe(1);
    expect(report.authorMetadata).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: repositoryIdentityEmail }),
    ]));
    expect(report.personalMetadata).toEqual([]);
    expect(report.findings).toEqual([]);

    writeFileSync(path.join(repository, 'history-secret.txt'), 'token=ghp_' + 'x'.repeat(28));
    commitAll(repository, 'history secret');
    const secretReport = auditPrivacy(repository, { mode: 'first-push', remote: 'origin' });
    expect(secretReport.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'github-token', severity: 'error' }),
    ]));
    expect(secretReport.largestBlobs.length).toBeGreaterThan(0);
  });

});
