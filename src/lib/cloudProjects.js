const PREVIEW_TEST_MODE = import.meta.env ? import.meta.env.VITE_PREVIEW_TEST_MODE === 'true' : false;

const ENV = import.meta.env || {};
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;

export const isCloudProjectsConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const CLOUD_PROJECT_LIMIT_ERROR = 'cloud_project_limit_reached';
export const CLOUD_PROJECT_LIMIT_MESSAGE = "You've run out of cloud projects you can save. Upgrade to unlock more local and cloud projects.";

export const isCloudProjectLimitError = (error) => {
  if (!error) return false;
  if (typeof error === 'object' && error.code === CLOUD_PROJECT_LIMIT_ERROR) return true;

  const detail = typeof error === 'string' ? error : String(error.message || '');
  if (detail.includes(CLOUD_PROJECT_LIMIT_ERROR)) return true;

  try {
    const parsed = JSON.parse(detail);
    const message = String(parsed?.message || parsed?.hint || '');
    return parsed?.code === 'P0001' && message.includes(CLOUD_PROJECT_LIMIT_ERROR);
  } catch {
    return false;
  }
};

export const createCloudWriteError = (detail, fallback) => {
  const error = new Error(detail || fallback);
  if (isCloudProjectLimitError(error)) {
    error.code = CLOUD_PROJECT_LIMIT_ERROR;
  }
  return error;
};

const throwCloudWriteError = (detail, fallback) => {
  throw createCloudWriteError(detail, fallback);
};

const getHeaders = (accessToken) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

const requireCloudConfig = (session) => {
  if (!isCloudProjectsConfigured()) {
    throw new Error('Cloud project storage is not configured yet.');
  }
  if (!session?.accessToken) {
    throw new Error('Sign in before using cloud project storage.');
  }
};

const toProjectMap = (rows) => rows.reduce((projects, row) => {
  projects[row.name] = {
    ...row.payload,
    id: row.id,
    updatedAt: row.updated_at,
  };
  return projects;
}, {});

export const listCloudProjects = async (session) => {
  if (PREVIEW_TEST_MODE) {
    const { listPreviewCloudProjects } = await import('./previewTestMode.js');
    return listPreviewCloudProjects();
  }
  requireCloudConfig(session);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_projects?select=id,name,payload,updated_at&order=updated_at.desc`, {
    headers: getHeaders(session.accessToken),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to load cloud projects.');
  }

  return toProjectMap(await response.json());
};

export const upsertCloudProject = async ({ session, userId, name, project }) => {
  if (PREVIEW_TEST_MODE) {
    const { upsertPreviewCloudProject } = await import('./previewTestMode.js');
    return upsertPreviewCloudProject({ name, project });
  }
  requireCloudConfig(session);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_projects?on_conflict=user_id,name`, {
    method: 'POST',
    headers: {
      ...getHeaders(session.accessToken),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      name,
      payload: project,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throwCloudWriteError(detail, 'Unable to save cloud project.');
  }

  return toProjectMap(await response.json());
};

export const deleteCloudProject = async ({ session, name }) => {
  if (PREVIEW_TEST_MODE) {
    const { deletePreviewCloudProject } = await import('./previewTestMode.js');
    return deletePreviewCloudProject({ name });
  }
  requireCloudConfig(session);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_projects?name=eq.${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: getHeaders(session.accessToken),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to delete cloud project.');
  }
};
