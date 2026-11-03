import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const protectedHistoryFiles = new Set([
  'docs/CODEX_COLLAB_LOG.md',
  'docs/REVIEW_LOG.md',
  'docs/PLAYTEST_LOG.md',
]);
const forbiddenLegacyIdentityParts = Object.freeze([]);
const forbiddenSecretPatterns = Object.freeze([
  { kind: 'private-key', pattern: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i },
  { kind: 'github-token', pattern: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,})\b/ },
  { kind: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { kind: 'openai-style-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'slack-token', pattern: /\bxox(?:b|p|o|a|s)-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'stripe-live-key', pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { kind: 'npm-auth-token', pattern: /(?:^|[^\w])_authToken\s*[:=]\s*[A-Za-z0-9_-]{20,}/i },
  { kind: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i },
]);
const absolutePathPatterns = Object.freeze([
  { kind: 'absolute-windows-user-path', pattern: /\b[A-Za-z]:[\\/]Users[\\/][^\r\n"'`]{2,}/i },
  { kind: 'absolute-windows-temp-path', pattern: /\b[A-Za-z]:[\\/](?:Temp|tmp|Windows[\\/]Temp|Users[\\/][^\r\n"'`]*[\\/]AppData[\\/]Local[\\/]Temp)[^\r\n"'`]*/i },
  { kind: 'absolute-unix-home-path', pattern: /(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+(?:\/[^\s"']*)?/ },
  { kind: 'absolute-unix-temp-path', pattern: /(?:^|\s)\/(?:tmp|var\/tmp|var\/folders)\/(?:[^\s"']+)/ },
  { kind: 'absolute-unc-path', pattern: /(?:^|[\s"'`=:(])\\\\[A-Za-z0-9._-]+[\\/][A-Za-z0-9._-]+/ },
  { kind: 'absolute-worktree-path', pattern: /(?:[\\/]\.codex[\\/]worktrees[\\/]|[\\/]worktrees[\\/])/i },
]);
const forbiddenFilePattern = /^(?:\.env(?:\..+)?|id_rsa|credentials\.json|.+\.(?:pem|key|p12|pfx))$/i;
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules', '.vercel']);

function finding(kind, filePath, severity = 'error', details = undefined) {
  return { kind, filePath, severity, ...(details ? { details } : {}) };
}

function scanTextVariant(text, filePath, { historicalMetadataOnly = false } = {}) {
  const findings = [];
  const severity = historicalMetadataOnly ? 'report' : 'error';
  const normalizedText = text.toLocaleLowerCase('en-US');
  if (forbiddenLegacyIdentityParts.some((identity) => normalizedText.includes(identity))) {
    findings.push(finding('legacy-identity', filePath, 'error'));
  }
  for (const { kind, pattern } of absolutePathPatterns) {
    if (pattern.test(text)) {
      findings.push(finding(kind, filePath, severity));
    }
  }
  for (const { kind, pattern } of forbiddenSecretPatterns) {
    if (pattern.test(text)) {
      findings.push(finding(kind, filePath, 'error'));
    }
  }
  return findings;
}

function scanGitConfiguration(repositoryRoot) {
  const findings = [];
  for (const scope of ['local', 'global']) {
    const output = gitText(repositoryRoot, ['config', `--${scope}`, '--list']);
    findings.push(
      ...scanText(output, `git-config:${scope}`)
        .filter((entry) => entry.kind === 'legacy-identity')
        .map((entry) => ({ ...entry, mode: 'config' })),
    );
  }
  return findings;
}

export function scanText(text, filePath = 'fixture.txt', options = {}) {
  return scanTextVariant(String(text), filePath, options);
}

const UTF16_SAMPLE_LIMIT = 4096;

function decodeUtf16Be(bytes, offset = 0) {
  const available = Math.min(bytes.length - offset, UTF16_SAMPLE_LIMIT);
  const source = bytes.subarray(offset, offset + available - (available % 2));
  const swapped = Buffer.alloc(source.length);
  for (let index = 0; index < source.length; index += 2) {
    swapped[index] = source[index + 1];
    swapped[index + 1] = source[index];
  }
  return swapped.toString('utf16le');
}

function isTextLikeUtf16(text) {
  if (text.length < 8 || text.includes('\u0000')) {
    return false;
  }
  let printable = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === '\t' || character === '\n' || character === '\r' || (codePoint >= 0x20 && codePoint !== 0xfffd)) {
      printable += 1;
    }
  }
  return printable / text.length >= 0.72;
}

function hasUtf16NullDistribution(bytes, offset) {
  const available = Math.min(bytes.length - offset, UTF16_SAMPLE_LIMIT);
  const sample = bytes.subarray(offset, offset + available);
  const pairCount = Math.floor(sample.length / 2);
  if (pairCount < 8) {
    return false;
  }
  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < sample.length; index += 1) {
    if (sample[index] === 0) {
      if (index % 2 === 0) evenNulls += 1;
      else oddNulls += 1;
    }
  }
  const dominant = Math.max(evenNulls, oddNulls);
  const minority = Math.min(evenNulls, oddNulls);
  return dominant >= Math.max(8, pairCount * 0.35) && dominant >= minority * 2 + 1;
}

export function decodeTextVariants(bytes) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const variants = [data.toString('utf8')];
  const hasLeBom = data.length >= 2 && data[0] === 0xff && data[1] === 0xfe;
  const hasBeBom = data.length >= 2 && data[0] === 0xfe && data[1] === 0xff;
  const leOffset = hasLeBom ? 2 : 0;
  const beOffset = hasBeBom ? 2 : 0;
  if (hasLeBom || (hasUtf16NullDistribution(data, 0) && isTextLikeUtf16(data.toString('utf16le', 0, UTF16_SAMPLE_LIMIT)))) {
    variants.push(data.toString('utf16le', leOffset, leOffset + UTF16_SAMPLE_LIMIT));
  }
  if (hasBeBom || (hasUtf16NullDistribution(data, 0) && isTextLikeUtf16(decodeUtf16Be(data, 0)))) {
    variants.push(decodeUtf16Be(data, beOffset));
  }
  return [...new Set(variants)];
}

export function scanBytes(bytes, filePath = 'fixture.txt', options = {}) {
  const findings = new Map();
  for (const variant of decodeTextVariants(bytes)) {
    for (const entry of scanTextVariant(variant, filePath, options)) {
      findings.set(entry.kind, entry);
    }
  }
  return [...findings.values()];
}

export function scanFileName(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const baseName = path.posix.basename(normalized);
  if (baseName === '.env.example') {
    return [];
  }
  return forbiddenFilePattern.test(baseName)
    ? [finding('forbidden-filename', normalized)]
    : [];
}

function normalizeGitPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function gitBuffer(repositoryRoot, args, options = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    timeout: options.timeout ?? 15_000,
    windowsHide: true,
  });
}

function gitText(repositoryRoot, args, options = {}) {
  return gitBuffer(repositoryRoot, args, options).toString('utf8');
}

function parseNullList(bytes) {
  return bytes.toString('utf8').split('\0').filter(Boolean).map(normalizeGitPath);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function filesystemFinding(repositoryRoot, relativePath, mode) {
  const normalized = normalizeGitPath(relativePath);
  const absolutePath = path.resolve(repositoryRoot, ...normalized.split('/'));
  const relativeToRoot = path.relative(repositoryRoot, absolutePath);
  if (relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return finding('path-escapes-repository', normalized, 'error', { mode });
  }
  let info;
  try {
    info = lstatSync(absolutePath);
  } catch (error) {
    return finding('missing-candidate', normalized, 'error', { mode, error: error.code ?? String(error) });
  }
  if (info.isSymbolicLink()) {
    return finding('symlink-candidate', normalized, 'error', { mode });
  }
  if (!info.isFile()) {
    return finding('non-regular-candidate', normalized, 'error', { mode });
  }
  try {
    const resolved = realpathSync(absolutePath);
    const realRoot = realpathSync(repositoryRoot);
    if (!isInside(realRoot, resolved)) {
      return finding('candidate-resolves-outside-repository', normalized, 'error', { mode });
    }
  } catch (error) {
    return finding('broken-candidate-link', normalized, 'error', { mode, error: error.code ?? String(error) });
  }
  return null;
}

function scanContent(repositoryRoot, relativePath, bytes, { mode, historicalMetadataOnly = false } = {}) {
  const findings = [
    ...scanFileName(relativePath),
    ...scanBytes(bytes, relativePath, { historicalMetadataOnly }),
  ];
  return findings.map((entry) => ({ ...entry, mode }));
}

function scanWorkingScope(repositoryRoot) {
  const paths = parseNullList(gitBuffer(repositoryRoot, ['ls-files', '-co', '--exclude-standard', '-z']));
  const deletedPaths = new Set(parseNullList(gitBuffer(repositoryRoot, ['diff', '--name-only', '--diff-filter=D', '-z'])));
  const findings = [];
  let scannedFiles = 0;
  for (const relativePath of paths) {
    const filesystemIssue = filesystemFinding(repositoryRoot, relativePath, 'working');
    if (filesystemIssue) {
      if (filesystemIssue.kind === 'missing-candidate' && deletedPaths.has(relativePath)) {
        continue;
      }
      findings.push(filesystemIssue);
      continue;
    }
    const bytes = readFileSync(path.join(repositoryRoot, ...relativePath.split('/')));
    findings.push(
      ...scanContent(repositoryRoot, relativePath, bytes, {
        mode: 'working',
        historicalMetadataOnly: protectedHistoryFiles.has(relativePath),
      }),
    );
    scannedFiles += 1;
  }
  findings.push(...scanGitConfiguration(repositoryRoot));
  return { mode: 'working', candidateCount: paths.length, scannedFiles, findings };
}

function stagedPaths(repositoryRoot) {
  return parseNullList(gitBuffer(repositoryRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB', '-z']));
}

function stagedBlob(repositoryRoot, relativePath) {
  const stageEntries = gitText(repositoryRoot, ['ls-files', '--stage', '-z', '--', relativePath]);
  const first = stageEntries.split('\0').find(Boolean);
  if (!first) {
    return { deleted: true };
  }
  const match = first.match(/^(\d{6}) [0-9a-f]{40} \d+\t/);
  if (!match) {
    return { invalid: true };
  }
  const mode = match[1];
  if (mode === '120000') {
    return { symlink: true };
  }
  if (mode !== '100644' && mode !== '100755') {
    return { special: true, mode };
  }
  return { bytes: gitBuffer(repositoryRoot, ['cat-file', '-p', `:${relativePath}`]) };
}

function scanStagedScope(repositoryRoot) {
  const paths = stagedPaths(repositoryRoot);
  const findings = [];
  let scannedFiles = 0;
  for (const relativePath of paths) {
    const blob = stagedBlob(repositoryRoot, relativePath);
    if (blob.deleted) {
      continue;
    }
    if (blob.symlink) {
      findings.push(finding('staged-symlink', relativePath, 'error', { mode: 'staged' }));
      continue;
    }
    if (blob.special || blob.invalid) {
      findings.push(finding('staged-non-regular-entry', relativePath, 'error', { mode: 'staged', modeBits: blob.mode }));
      continue;
    }
    findings.push(...scanContent(repositoryRoot, relativePath, blob.bytes, { mode: 'staged' }));
    scannedFiles += 1;
  }
  findings.push(...scanGitConfiguration(repositoryRoot));
  return { mode: 'staged', candidateCount: paths.length, scannedFiles, findings };
}

function remoteHeads(repositoryRoot, remote) {
  const output = gitText(repositoryRoot, ['ls-remote', '--heads', remote], { timeout: 8_000 });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [oid, ref] = line.split(/\s+/);
      if (!/^[0-9a-f]{40}$/.test(oid ?? '')) {
        throw new Error(`Remote ${remote} returned an invalid head: ${line}`);
      }
      return { oid, ref };
    });
}

function commitMetadata(repositoryRoot, commitId) {
  const raw = gitText(repositoryRoot, ['show', '-s', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B', commitId]);
  const [hash, authorName, authorEmail, committerName, committerEmail, ...messageParts] = raw.split('\0');
  return {
    hash,
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    message: messageParts.join('\0'),
  };
}

function scanHistoryScope(repositoryRoot, remote = 'origin') {
  const heads = remoteHeads(repositoryRoot, remote);
  const emptyRemote = heads.length === 0;
  const commitArgs = emptyRemote
    ? ['rev-list', '--all']
    : ['rev-list', 'HEAD', '--not', ...heads.map((head) => head.oid)];
  const commitIds = gitText(repositoryRoot, commitArgs).split(/\r?\n/).filter(Boolean);
  const objectLines = commitIds.length > 0
    ? gitText(repositoryRoot, ['rev-list', '--objects', ...commitIds]).split(/\r?\n/).filter(Boolean)
    : [];
  const blobPaths = new Map();
  for (const line of objectLines) {
    const separator = line.indexOf(' ');
    const objectId = separator < 0 ? line : line.slice(0, separator);
    const objectPath = separator < 0 ? undefined : normalizeGitPath(line.slice(separator + 1));
    const type = gitText(repositoryRoot, ['cat-file', '-t', objectId]).trim();
    if (type !== 'blob') {
      continue;
    }
    const paths = blobPaths.get(objectId) ?? [];
    if (objectPath) paths.push(objectPath);
    blobPaths.set(objectId, paths);
  }

  const findings = [];
  const largestBlobs = [];
  for (const [objectId, paths] of blobPaths) {
    const size = Number.parseInt(gitText(repositoryRoot, ['cat-file', '-s', objectId]), 10);
    largestBlobs.push({ objectId, size, paths: [...new Set(paths)] });
    const bytes = gitBuffer(repositoryRoot, ['cat-file', '-p', objectId]);
    for (const relativePath of paths.length > 0 ? paths : [`blob:${objectId}`]) {
      findings.push(...scanContent(repositoryRoot, relativePath, bytes, { mode: 'history' }));
    }
  }

  const metadata = commitIds.map((commitId) => commitMetadata(repositoryRoot, commitId));
  for (const commit of metadata) {
    findings.push(...scanText(`${commit.authorName} <${commit.authorEmail}>\n${commit.committerName} <${commit.committerEmail}>\n${commit.message}`, `commit:${commit.hash}:metadata`));
  }
  const authors = [...new Map(metadata.flatMap((commit) => [
    [`author:${commit.authorName}\0${commit.authorEmail}`, { role: 'author', name: commit.authorName, email: commit.authorEmail }],
    [`committer:${commit.committerName}\0${commit.committerEmail}`, { role: 'committer', name: commit.committerName, email: commit.committerEmail }],
  ])).values()];
  findings.push(...scanGitConfiguration(repositoryRoot));
  largestBlobs.sort((a, b) => b.size - a.size);
  return {
    mode: 'first-push',
    remote,
    remoteState: emptyRemote ? 'empty' : 'non-empty',
    remoteHeads: heads,
    commitCount: commitIds.length,
    blobCount: blobPaths.size,
    scannedFiles: blobPaths.size,
    findings,
    authorMetadata: authors,
    personalMetadata: [],
    largestBlobs: largestBlobs.slice(0, 10),
  };
}

export function scanRepository(repositoryRoot = defaultRepositoryRoot) {
  return scanWorkingScope(repositoryRoot).findings;
}

export function auditPrivacy(repositoryRoot = defaultRepositoryRoot, { mode = 'working', remote = 'origin' } = {}) {
  if (mode === 'working' || mode === 'precommit') {
    return scanWorkingScope(repositoryRoot);
  }
  if (mode === 'staged') {
    return scanStagedScope(repositoryRoot);
  }
  if (mode === 'prepush' || mode === 'first-push') {
    return scanHistoryScope(repositoryRoot, remote);
  }
  throw new Error(`Unsupported privacy scan mode: ${mode}.`);
}

export async function runPrivacyScan(repositoryRoot = defaultRepositoryRoot, logger = console, options = {}) {
  try {
    const report = auditPrivacy(repositoryRoot, options);
    const errors = report.findings.filter((entry) => entry.severity !== 'report');
    const reportOnly = report.findings.filter((entry) => entry.severity === 'report');
    if (errors.length > 0) {
      logger.error('[privacy-scan] FAIL');
      logger.error(JSON.stringify({ ...report, findings: errors, reportOnly }, null, 2));
      return 1;
    }
    logger.log('[privacy-scan] PASS');
    logger.log(JSON.stringify({ ...report, findings: 0, reportOnly }, null, 2));
    return 0;
  } catch (error) {
    logger.error('[privacy-scan] FAIL');
    logger.error(error instanceof Error ? error.stack ?? error.message : error);
    return 1;
  }
}

function parseCliArguments(argumentsList) {
  const options = { mode: 'working', remote: 'origin' };
  for (const argument of argumentsList) {
    if (argument.startsWith('--mode=')) {
      options.mode = argument.slice('--mode='.length);
    } else if (argument.startsWith('--remote=')) {
      options.remote = argument.slice('--remote='.length);
    } else {
      throw new Error(`Unknown privacy scanner argument: ${argument}`);
    }
  }
  return options;
}

const isDirectInvocation = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);
if (isDirectInvocation) {
  try {
    process.exitCode = await runPrivacyScan(defaultRepositoryRoot, console, parseCliArguments(process.argv.slice(2)));
  } catch (error) {
    console.error('[privacy-scan] FAIL');
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  }
}
