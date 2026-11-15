import { PROJECT_NAME_MAX_LENGTH, sanitizeProjectName } from './calculation.js';

export const TAKEN_PROJECT_NAME_MESSAGE = 'A project with this name already exists';
export const DIRECT_SAVE_SOURCES = new Set(['local', 'cloud']);

export const canDirectSave = (loadedProjectSource, loadedProjectName) => {
  const name = sanitizeProjectName(loadedProjectName);
  return Boolean(name) && DIRECT_SAVE_SOURCES.has(loadedProjectSource);
};

export const isProjectNameTaken = (name, projects = {}) => {
  const trimmedName = sanitizeProjectName(name);
  if (!trimmedName) return false;
  return Object.prototype.hasOwnProperty.call(projects, trimmedName);
};

const copyName = (stem, index) => {
  const suffix = ` (${index})`;
  const maxStemLength = Math.max(0, PROJECT_NAME_MAX_LENGTH - suffix.length);
  return `${String(stem).slice(0, maxStemLength)}${suffix}`;
};

export const suggestAvailableProjectName = (name, projects = {}) => {
  const trimmedName = sanitizeProjectName(name);
  if (!trimmedName) return '';
  if (!isProjectNameTaken(trimmedName, projects)) return trimmedName;

  const suffixMatch = trimmedName.match(/^(.*)\s\((\d+)\)$/u);
  const stem = suffixMatch ? suffixMatch[1] : trimmedName;
  let index = suffixMatch ? Number(suffixMatch[2]) + 1 : 2;

  for (let attempt = 0; attempt < 1000; attempt += 1, index += 1) {
    const candidate = copyName(stem, index);
    if (!isProjectNameTaken(candidate, projects)) return candidate;
  }

  return '';
};

export const getProjectNameConflict = (name, projects = {}) => {
  if (!isProjectNameTaken(name, projects)) {
    return { taken: false, suggestion: '', message: '' };
  }

  const suggestion = suggestAvailableProjectName(name, projects);
  return {
    taken: true,
    suggestion,
    message: TAKEN_PROJECT_NAME_MESSAGE,
  };
};
