const API_BASE = 'https://api.netlify.com/api/v1';

export const isProtectedDeploy = (deploy, publishedDeployId) => {
  if (!deploy?.id) return true;
  if (publishedDeployId && deploy.id === publishedDeployId) return true;
  if (deploy.published_at) return true;
  if (deploy.locked) return true;
  if (deploy.context === 'production') return true;
  if (deploy.context === 'branch-deploy') return true;
  return false;
};

const textBlob = (deploy) => [
  deploy.alias,
  deploy.title,
  deploy.url,
  deploy.ssl_url,
  deploy.deploy_url,
  deploy.deploy_ssl_url,
].filter(Boolean).join(' ');

export const isPreviewDeploy = (deploy, publishedDeployId) => {
  if (isProtectedDeploy(deploy, publishedDeployId)) return false;
  if (deploy.context === 'deploy-preview') return true;
  // CLI deploys from this repo use --alias pr-N and a "PR #N" message,
  // and may not always set context=deploy-preview.
  if (typeof deploy.alias === 'string' && /^pr-\d+$/u.test(deploy.alias)) return true;
  if (deploy.review_id != null && String(deploy.review_id) !== '') return true;
  if (typeof deploy.title === 'string' && /PR #\d+/u.test(deploy.title)) return true;
  if (/pr-\d+--/u.test(textBlob(deploy))) return true;
  return false;
};

export const matchesPullRequest = (deploy, { prNumber, branch } = {}) => {
  if (prNumber == null || prNumber === '') return false;
  const number = String(prNumber);
  if (deploy.review_id != null && String(deploy.review_id) === number) return true;
  if (deploy.alias === `pr-${number}`) return true;
  if (typeof deploy.title === 'string' && deploy.title.includes(`PR #${number}`)) return true;
  if (new RegExp(`pr-${number}--`, 'u').test(textBlob(deploy))) return true;
  if (branch && deploy.branch === branch) return true;
  return false;
};

export const selectLatestPreview = (deploys) => {
  const sorted = [...deploys].sort((left, right) => {
    const readyBonus = (deploy) => (deploy.state === 'ready' ? 1 : 0);
    const readyDelta = readyBonus(right) - readyBonus(left);
    if (readyDelta !== 0) return readyDelta;
    return Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0);
  });
  return sorted[0] || null;
};

export const selectDeploysToDelete = (deploys, {
  mode,
  prNumber,
  branch,
  keepPr,
  publishedDeployId,
} = {}) => {
  const previews = deploys.filter((deploy) => isPreviewDeploy(deploy, publishedDeployId));
  const protectedDeploys = deploys.filter((deploy) => isProtectedDeploy(deploy, publishedDeployId));

  if (mode === 'pr') {
    const matched = previews.filter((deploy) => matchesPullRequest(deploy, { prNumber, branch }));
    return {
      delete: matched,
      keep: previews.filter((deploy) => !matched.includes(deploy)),
      protected: protectedDeploys,
    };
  }

  if (mode === 'all-except') {
    const keepCandidates = previews.filter((deploy) => matchesPullRequest(deploy, { prNumber: keepPr }));
    const keep = selectLatestPreview(keepCandidates);
    const keepIds = new Set(keep ? [keep.id] : []);
    return {
      delete: previews.filter((deploy) => !keepIds.has(deploy.id)),
      keep: keep ? [keep] : [],
      protected: protectedDeploys,
    };
  }

  throw new Error(`Unknown cleanup mode: ${mode}`);
};

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const netlifyFetch = async (token, path, { method = 'GET' } = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Netlify API ${method} ${path} failed (${response.status}): ${text || response.statusText}`);
  }
  return text ? JSON.parse(text) : null;
};

export const listAllSiteDeploys = async ({ token, siteId, fetchPage = netlifyFetch } = {}) => {
  const deploys = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await fetchPage(token, `/sites/${siteId}/deploys?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    deploys.push(...batch);
    if (batch.length < 100) break;
  }
  return deploys;
};

export const parseCleanupArgs = (argv) => {
  const args = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--mode') args.mode = next, index += 1;
    else if (arg === '--pr') args.prNumber = next, index += 1;
    else if (arg === '--branch') args.branch = next, index += 1;
    else if (arg === '--keep-pr') args.keepPr = next, index += 1;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help') args.help = true;
  }
  return args;
};

const summarize = (deploy) => ({
  id: deploy.id,
  context: deploy.context || null,
  alias: deploy.alias || null,
  review_id: deploy.review_id ?? null,
  branch: deploy.branch || null,
  title: deploy.title || null,
  state: deploy.state || null,
  created_at: deploy.created_at || null,
});

export const runCleanup = async ({
  args = parseCleanupArgs(process.argv.slice(2)),
  env = process.env,
  fetchPage = netlifyFetch,
  log = console,
} = {}) => {
  if (args.help) {
    log.log('Usage: node scripts/netlify-preview-cleanup.js --mode pr --pr <n> [--branch <name>] [--dry-run]');
    log.log('       node scripts/netlify-preview-cleanup.js --mode all-except --keep-pr <n> [--dry-run]');
    return { deleted: [], kept: [], protected: [] };
  }

  if (!args.mode) throw new Error('Missing --mode (pr or all-except).');
  if (args.mode === 'pr' && !args.prNumber) throw new Error('Missing --pr.');
  if (args.mode === 'all-except' && !args.keepPr) throw new Error('Missing --keep-pr.');

  const token = env.NETLIFY_AUTH_TOKEN || requiredEnv('NETLIFY_AUTH_TOKEN');
  const siteId = env.NETLIFY_SITE_ID || requiredEnv('NETLIFY_SITE_ID');
  const site = await fetchPage(token, `/sites/${siteId}`);
  const publishedDeployId = site?.published_deploy?.id || site?.published_deploy_id || null;
  const deploys = await listAllSiteDeploys({ token, siteId, fetchPage });
  const selected = selectDeploysToDelete(deploys, {
    mode: args.mode,
    prNumber: args.prNumber,
    branch: args.branch,
    keepPr: args.keepPr,
    publishedDeployId,
  });

  log.log(JSON.stringify({
    dryRun: Boolean(args.dryRun),
    publishedDeployId,
    deleteCount: selected.delete.length,
    keepCount: selected.keep.length,
    protectedCount: selected.protected.length,
    delete: selected.delete.map(summarize),
    keep: selected.keep.map(summarize),
  }, null, 2));

  if (args.dryRun) {
    return { ...selected, deleted: [], publishedDeployId };
  }

  const deleted = [];
  for (const deploy of selected.delete) {
    if (isProtectedDeploy(deploy, publishedDeployId)) {
      throw new Error(`Refusing to delete protected deploy ${deploy.id}.`);
    }
    await fetchPage(token, `/deploys/${deploy.id}`, { method: 'DELETE' });
    deleted.push(deploy);
    log.log(`Deleted ${deploy.id} (${deploy.alias || deploy.title || deploy.context || 'preview'}).`);
  }

  log.log(`Deleted ${deleted.length} deploy-preview deploy(s).`);
  return { ...selected, deleted, publishedDeployId };
};

const isMain = process.argv[1] && String(process.argv[1]).endsWith('netlify-preview-cleanup.js');
if (isMain) {
  runCleanup().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
