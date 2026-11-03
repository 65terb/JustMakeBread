import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
export function configureGitHooks(repositoryRoot) {
  const gitConfig = (args) => execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  let current = '';
  try {
    current = gitConfig(['config', '--local', '--get', 'core.hooksPath']);
  } catch {
    current = '';
  }
  if (current === '.githooks') {
    return 'already-configured';
  }
  gitConfig(['config', '--local', 'core.hooksPath', '.githooks']);
  return 'configured';
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');
  const result = configureGitHooks(repositoryRoot);
  console.log(result === 'configured'
    ? '[hooks] configured core.hooksPath=.githooks'
    : '[hooks] core.hooksPath already configured as .githooks');
}
