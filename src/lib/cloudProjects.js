const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isCloudProjectsConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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
    throw new Error(detail || 'Unable to save cloud project.');
  }

  return toProjectMap(await response.json());
};

export const deleteCloudProject = async ({ session, name }) => {
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
