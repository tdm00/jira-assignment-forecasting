import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Short git commit for the build. At least 8 characters, longer when that prefix is not unique. */
export function appRevision(): string {
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    const sha = execSync('git rev-parse --short=8 HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[0-9a-f]{8,}$/i.test(sha)) return sha;
  } catch {
    // Not a git checkout (for example a copied folder). Fall back to package.json.
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return String(pkg.version);
}
