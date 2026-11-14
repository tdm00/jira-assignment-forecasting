import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Release version from package.json (set by release-please), for example `v5.1.0`. */
export function appRelease(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return `v${String(pkg.version)}`;
}

/**
 * Version shown in the app: the release plus the short git commit of the build, for example
 * `v5.1.0 (3d3c42e5)`. The commit is at least 8 characters, longer when that prefix is not
 * unique. Outside a git checkout (for example a copied folder) it is the release alone.
 */
export function appRevision(): string {
  const release = appRelease();
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    const sha = execSync('git rev-parse --short=8 HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[0-9a-f]{8,}$/i.test(sha)) return `${release} (${sha})`;
  } catch {
    // Not a git checkout. Show the release alone.
  }
  return release;
}
