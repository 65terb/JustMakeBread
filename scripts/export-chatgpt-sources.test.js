import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { TextDecoder } from 'node:util';

const exportScript = resolve('scripts/export-chatgpt-sources.ps1');
const fixedTimestamp = '2026-08-06_120000';

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(args) {
  const executable = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  return spawnSync(executable, ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runExport(fixture) {
  return runPowerShell([
    '-File', exportScript,
    '-RepoRoot', fixture.repo,
    '-ManifestPath', fixture.manifestPath,
    '-OutputRoot', fixture.output,
    '-Timestamp', fixedTimestamp,
    '-StagingRoot', fixture.staging,
  ]);
}

function combinedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function writeManifest(fixture, files) {
  writeFileSync(fixture.manifestPath, JSON.stringify({ projectSlug: 'fixture-game', files }, null, 2));
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'track1-export-test-'));
  const repo = join(root, 'repo');
  const output = join(root, 'output');
  const staging = join(root, 'staging');
  const docs = join(repo, 'docs');
  const manifestPath = join(repo, 'manifest.json');

  mkdirSync(docs, { recursive: true });
  mkdirSync(output, { recursive: true });
  mkdirSync(staging, { recursive: true });
  writeFileSync(join(repo, 'AGENTS.md'), '# Fixture rules\n');
  writeFileSync(join(docs, 'guide.md'), '# Fixture guide\n');
  writeManifest({ manifestPath }, ['AGENTS.md', 'docs/guide.md']);

  return { root, repo, output, staging, manifestPath };
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function createExternalReparsePoint(linkPath, targetPath) {
  if (process.platform === 'win32') {
    const command = `New-Item -ItemType Junction -Path ${psQuote(linkPath)} -Target ${psQuote(targetPath)} -Force | Out-Null`;
    const result = runPowerShell(['-Command', command]);
    if (result.status !== 0) {
      throw new Error(`Unable to create junction fixture: ${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    }
    return;
  }

  symlinkSync(targetPath, linkPath, 'dir');
}

describe('ChatGPT canonical Markdown export', () => {
  let fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it('exports relative paths and a SHA-256 manifest', { timeout: 15_000 }, () => {
    const result = runExport(fixture);

    expect(result.status, combinedOutput(result)).toBe(0);
    expect(combinedOutput(result)).toContain('Created:');

    const zipFiles = readdirSync(fixture.output).filter((name) => name.endsWith('.zip'));
    expect(zipFiles).toHaveLength(1);

    const extracted = join(fixture.root, 'extracted');
    mkdirSync(extracted);
    const expanded = runPowerShell([
      '-Command',
      `Expand-Archive -LiteralPath ${psQuote(join(fixture.output, zipFiles[0]))} -DestinationPath ${psQuote(extracted)} -Force`,
    ]);
    expect(expanded.status).toBe(0);

    expect(readFileSync(join(extracted, 'AGENTS.md'), 'utf8')).toBe('# Fixture rules\n');
    expect(readFileSync(join(extracted, 'docs', 'guide.md'), 'utf8')).toBe('# Fixture guide\n');

    const exportedManifest = JSON.parse(readFileSync(join(extracted, 'CHATGPT_SOURCE_MANIFEST.json'), 'utf8'));
    expect(exportedManifest.projectSlug).toBe('fixture-game');
    expect(exportedManifest.files.map((entry) => entry.path)).toEqual(['AGENTS.md', 'docs/guide.md']);
    for (const entry of exportedManifest.files) {
      const extractedPath = join(extracted, ...entry.path.split('/'));
      expect(existsSync(extractedPath)).toBe(true);
      expect(sha256(extractedPath)).toBe(entry.sha256);
    }
    expect(readdirSync(fixture.staging)).toEqual([]);
  });

  it('fails clearly for a missing source and leaves staging clean', () => {
    writeManifest(fixture, ['AGENTS.md', 'docs/missing.md']);

    const result = runExport(fixture);

    expect(result.status).not.toBe(0);
    expect(combinedOutput(result)).toContain('Missing export source file: docs/missing.md');
    expect(readdirSync(fixture.staging)).toEqual([]);
  });

  it('rejects duplicate, traversal, absolute, and forbidden paths', { timeout: 15_000 }, () => {
    const cases = [
      { files: ['AGENTS.md', 'AGENTS.md'], message: 'Duplicate export path' },
      { files: ['../AGENTS.md'], message: 'traversal segments' },
      { files: [resolve(fixture.repo, 'outside.md')], message: 'repo-relative' },
      { files: ['docs/notes.js'], message: 'forbidden source or media file' },
    ];

    for (const testCase of cases) {
      writeManifest(fixture, testCase.files);
      const result = runExport(fixture);
      expect(result.status, testCase.message).not.toBe(0);
      expect(combinedOutput(result), testCase.message).toContain(testCase.message);
      expect(readdirSync(fixture.staging), testCase.message).toEqual([]);
    }
  });

  it('rejects a manifest path that traverses a junction or symlink outside the repository', () => {
    const outside = join(fixture.root, 'outside');
    const linkedDocs = join(fixture.repo, 'linked-docs');
    mkdirSync(outside);
    writeFileSync(join(outside, 'secret.md'), '# Outside source\n');
    createExternalReparsePoint(linkedDocs, outside);
    writeManifest(fixture, ['linked-docs/secret.md']);

    const result = runExport(fixture);

    expect(result.status).not.toBe(0);
    expect(combinedOutput(result)).toContain('reparse point');
    expect(readdirSync(fixture.staging)).toEqual([]);
  });

  it('does not overwrite a same-minute export', () => {
    const first = runExport(fixture);
    const second = runExport(fixture);

    expect(first.status, combinedOutput(first)).toBe(0);
    expect(second.status).toBe(0);
    const zipFiles = readdirSync(fixture.output).filter((name) => name.endsWith('.zip')).sort();
    expect(zipFiles).toEqual([
      'fixture-game_chatgpt_sources_2026-08-06_120000.zip',
      'fixture-game_chatgpt_sources_2026-08-06_120000_01.zip',
    ]);
  });

  it('decodes Commit Audit UI metadata as strict UTF-8 Korean', () => {
    const metadataPath = resolve('.agents/skills/commit-audit/agents/openai.yaml');
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(metadataPath));

    expect(decoded).toContain('커밋');
    expect(decoded).toContain('회귀');
    expect(decoded).not.toContain('\uFFFD');
  });
});
