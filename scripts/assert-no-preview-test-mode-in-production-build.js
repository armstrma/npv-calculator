import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const PATTERNS = [
  'Preview test mode',
  'Preview tester',
  'npvPreviewCloud',
  'npvPreviewPro',
  'preview-tester@npvlab.local',
  'preview-test-mode',
  'VITE_PREVIEW_TEST_MODE',
];

const TEXT_EXTENSIONS = new Set(['.js', '.css', '.html', '.map', '.json', '.txt', '.svg']);

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
};

const outDir = mkdtempSync(join(tmpdir(), 'npv-production-dist-'));
const env = { ...process.env };
delete env.VITE_PREVIEW_TEST_MODE;

const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
  env,
  encoding: 'utf8',
});

if (build.status !== 0) {
  process.stderr.write(build.stdout || '');
  process.stderr.write(build.stderr || '');
  throw new Error('Production build failed.');
}

const leaks = [];
for (const file of walk(outDir)) {
  if (!TEXT_EXTENSIONS.has(extname(file)) && extname(file) !== '') continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    if (content.includes(pattern)) {
      leaks.push(`${file.replace(outDir, 'dist')}: ${pattern}`);
    }
  }
}

if (leaks.length) {
  process.stderr.write('Preview test mode leaked into the production build:\n');
  process.stderr.write(`${leaks.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Production build is clean (${outDir}).\n`);
