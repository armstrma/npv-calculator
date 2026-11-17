import { expect, test } from '@playwright/test';

const desktopToolbar = (page) => page.locator('.mobile-topbar-shell-desktop');
const mobileToolbar = (page) => page.locator('.mobile-topbar-shell:not(.mobile-topbar-shell-desktop)');
const quickInputs = (page) => page.locator('.quick-view-controls input[type="text"]');
const saveDialog = (page, title = 'Local Save') => page.getByRole('dialog', { name: title });

const clearBrowserState = async (page) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

const openDestinationSubmenu = async (page, { toolbar = desktopToolbar(page), destination = 'local' } = {}) => {
  await toolbar.getByLabel('Save options').click();
  const parentName = destination === 'cloud' ? 'Save to Cloud' : 'Save Locally';
  await toolbar.getByRole('button', { name: parentName }).click();
  await expect(toolbar.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Save as…' })).toBeVisible();
};

const chooseSubmenuSave = async (page, options = {}) => {
  const toolbar = options.toolbar || desktopToolbar(page);
  await openDestinationSubmenu(page, options);
  await toolbar.getByRole('button', { name: 'Save', exact: true }).click();
};

const chooseSubmenuSaveAs = async (page, options = {}) => {
  const toolbar = options.toolbar || desktopToolbar(page);
  await openDestinationSubmenu(page, options);
  await toolbar.getByRole('button', { name: 'Save as…' }).click();
};

const saveNewLocalProject = async (page, name, toolbar = desktopToolbar(page)) => {
  await chooseSubmenuSave(page, { toolbar, destination: 'local' });
  const dialog = saveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Project name').fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
};

const readStoredProjects = (page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('npvProjects') || '{}');
  } catch {
    return {};
  }
});

const readDraftModel = (page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('npvWorkingDraft') || 'null')?.model ?? null;
  } catch {
    return null;
  }
});

test.beforeEach(async ({ page }) => {
  await clearBrowserState(page);
});

test('submenu Save on a loaded project overwrites with no modal', async ({ page }) => {
  await page.goto('/');
  await quickInputs(page).first().fill('1234');
  await quickInputs(page).first().blur();
  await saveNewLocalProject(page, 'Loaded Case');

  await quickInputs(page).first().fill('9999');
  await quickInputs(page).first().blur();

  await chooseSubmenuSave(page);
  await expect(saveDialog(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Saved “Loaded Case” on this device.');

  await expect.poll(async () => (await readStoredProjects(page))['Loaded Case']?.initial ?? null).toBe(9999);

  await quickInputs(page).first().fill('1111');
  await quickInputs(page).first().blur();

  await desktopToolbar(page).getByLabel('Open project library').click();
  await page.locator('.mobile-library-saved-open').filter({ hasText: 'Loaded Case' }).click();
  await expect(quickInputs(page).first()).toHaveValue('9,999');
});

test('Save on scratch asks for a name', async ({ page }) => {
  await page.goto('/');
  await chooseSubmenuSave(page);

  const dialog = saveDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Choose a name to save this project.')).toBeVisible();
  await expect(dialog.getByText('Saved in this browser only')).toBeVisible();
  await expect(dialog.getByLabel('Project name')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save as' })).toHaveCount(0);

  await dialog.getByLabel('Project name').fill('Scratch Project');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => Object.keys(await readStoredProjects(page))).toEqual(['Scratch Project']);
  await expect.poll(async () => (await readDraftModel(page))?.loadedProjectName ?? null).toBe('Scratch Project');
  await expect.poll(async () => (await readDraftModel(page))?.loadedProjectSource ?? null).toBe('local');
});

test('Save as with a taken name shows an inline message and does not overwrite', async ({ page }) => {
  await page.goto('/');
  await quickInputs(page).first().fill('1234');
  await quickInputs(page).first().blur();
  await saveNewLocalProject(page, 'Taken Name');

  await quickInputs(page).first().fill('9999');
  await quickInputs(page).first().blur();

  await chooseSubmenuSaveAs(page);
  const dialog = saveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Project name').fill('Taken Name');

  await expect(dialog.getByText('A project with this name already exists')).toBeVisible();
  await expect(dialog.getByText('Try “Taken Name (2)”.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save as' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Use “Taken Name (2)”' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Overwrite' })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => (await readStoredProjects(page))['Taken Name']?.initial ?? null).toBe(1234);
  await expect.poll(async () => Object.keys(await readStoredProjects(page))).toEqual(['Taken Name']);
});

test('Save as with a new name creates a project and makes it current', async ({ page }) => {
  await page.goto('/');
  await quickInputs(page).first().fill('1234');
  await quickInputs(page).first().blur();
  await saveNewLocalProject(page, 'Original Project');

  await quickInputs(page).first().fill('8888');
  await quickInputs(page).first().blur();

  await chooseSubmenuSaveAs(page);
  const dialog = saveDialog(page);
  await expect(dialog.getByLabel('Project name')).toHaveValue('Original Project (2)');
  await dialog.getByLabel('Project name').fill('Copied Project');
  await dialog.getByRole('button', { name: 'Save as' }).click();
  await expect(dialog).toBeHidden();

  await expect(page).toHaveTitle('NPV Lab | Copied Project');
  await expect.poll(async () => (await readDraftModel(page))?.loadedProjectName ?? null).toBe('Copied Project');
  await expect.poll(async () => (await readDraftModel(page))?.loadedProjectSource ?? null).toBe('local');
  await expect.poll(async () => {
    const projects = await readStoredProjects(page);
    return {
      names: Object.keys(projects).sort(),
      original: projects['Original Project']?.initial ?? null,
      copy: projects['Copied Project']?.initial ?? null,
    };
  }).toEqual({
    names: ['Copied Project', 'Original Project'],
    original: 1234,
    copy: 8888,
  });

  await quickInputs(page).first().fill('7777');
  await quickInputs(page).first().blur();
  await chooseSubmenuSave(page);
  await expect(saveDialog(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Saved “Copied Project” on this device.');

  await expect.poll(async () => (await readStoredProjects(page))['Copied Project']?.initial ?? null).toBe(7777);
  await expect.poll(async () => (await readStoredProjects(page))['Original Project']?.initial ?? null).toBe(1234);
});

test('Escape closes the Save submenu', async ({ page }) => {
  await page.goto('/');
  const toolbar = desktopToolbar(page);
  await openDestinationSubmenu(page, { toolbar, destination: 'local' });

  await page.keyboard.press('Escape');
  await expect(toolbar.getByRole('button', { name: 'Save as…' })).toBeHidden();
  await expect(toolbar.getByRole('button', { name: 'Save', exact: true })).toBeHidden();
  await expect(toolbar.getByRole('button', { name: 'Save Locally' })).toBeHidden();
});

test('mobile Save as flow works on the compact toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await quickInputs(page).first().fill('2468');
  await quickInputs(page).first().blur();
  await saveNewLocalProject(page, 'Mobile Original', mobileToolbar(page));

  await quickInputs(page).first().fill('1357');
  await quickInputs(page).first().blur();

  await chooseSubmenuSaveAs(page, { toolbar: mobileToolbar(page), destination: 'local' });
  const dialog = saveDialog(page);
  await expect(dialog.getByText('Saved in this browser only')).toBeVisible();
  await dialog.getByLabel('Project name').fill('Mobile Copy');
  await dialog.getByRole('button', { name: 'Save as' }).click();
  await expect(dialog).toBeHidden();

  await expect(page).toHaveTitle('NPV Lab | Mobile Copy');
  await expect.poll(async () => (await readDraftModel(page))?.loadedProjectName ?? null).toBe('Mobile Copy');
  await expect.poll(async () => (await readStoredProjects(page))['Mobile Original']?.initial ?? null).toBe(2468);
  await expect.poll(async () => (await readStoredProjects(page))['Mobile Copy']?.initial ?? null).toBe(1357);
});
