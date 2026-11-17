import { expect, test } from '@playwright/test';

const desktopToolbar = (page) => page.locator('.mobile-topbar-shell-desktop');
const quickInputs = (page) => page.locator('.quick-view-controls input[type="text"]');
const saveDialog = (page, title = 'Cloud Save') => page.getByRole('dialog', { name: title });

const readPreviewCloud = (page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('npvPreviewCloud') || '{}');
  } catch {
    return {};
  }
});

const openCloudSaveSubmenu = async (page) => {
  await desktopToolbar(page).getByLabel('Save options').click();
  await desktopToolbar(page).getByRole('button', { name: 'Save to Cloud' }).click();
  await expect(desktopToolbar(page).getByRole('button', { name: 'Save as…' })).toBeVisible();
};

const chooseCloudSave = async (page) => {
  await openCloudSaveSubmenu(page);
  await desktopToolbar(page).getByRole('button', { name: 'Save', exact: true }).click();
};

const chooseCloudSaveAs = async (page) => {
  await openCloudSaveSubmenu(page);
  await desktopToolbar(page).getByRole('button', { name: 'Save as…' }).click();
};

test.beforeEach(async ({ page }) => {
  const supabaseRequests = [];
  await page.route((url) => {
    const href = url.href;
    return href.includes('127.0.0.1:43210') || href.includes('supabase.co') || href.includes('/auth/v1/') || href.includes('/rest/v1/');
  }, (route) => {
    supabaseRequests.push(route.request().url());
    return route.abort();
  });
  page.supabaseRequests = supabaseRequests;

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test('Pro off hits the cloud save limit and Pro on allows cloud Save, Save as, and load', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Preview test mode' })).toBeVisible();
  await expect(page.getByText('Preview tester')).toBeVisible();
  const proSwitch = page.getByRole('switch', { name: 'Pro' });
  await expect(proSwitch).not.toBeChecked();

  await quickInputs(page).first().fill('1234');
  await quickInputs(page).first().blur();
  await chooseCloudSave(page);

  const dialog = saveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Project name').fill('Cloud One');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await readPreviewCloud(page))['Cloud One']?.initial ?? null).toBe(1234);

  await quickInputs(page).first().fill('8888');
  await quickInputs(page).first().blur();
  await chooseCloudSaveAs(page);
  await saveDialog(page).getByLabel('Project name').fill('Cloud Two');
  await saveDialog(page).getByRole('button', { name: 'Save as' }).click();

  await expect(page.getByRole('heading', { name: 'Upgrade NPV Lab' })).toBeVisible();
  await expect.poll(async () => Object.keys(await readPreviewCloud(page))).toEqual(['Cloud One']);

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upgrade NPV Lab' })).toBeHidden();
  if (await saveDialog(page).isVisible()) {
    await saveDialog(page).getByRole('button', { name: 'Cancel' }).click();
  }

  await proSwitch.check();
  await expect(proSwitch).toBeChecked();
  await expect(desktopToolbar(page).getByLabel('Upgraded account')).toBeVisible();

  await chooseCloudSaveAs(page);
  await saveDialog(page).getByLabel('Project name').fill('Cloud Two');
  await saveDialog(page).getByRole('button', { name: 'Save as' }).click();
  await expect(saveDialog(page)).toBeHidden();
  await expect(page).toHaveTitle('NPV Lab | Cloud Two');
  await expect.poll(async () => {
    const projects = await readPreviewCloud(page);
    return {
      names: Object.keys(projects).sort(),
      one: projects['Cloud One']?.initial ?? null,
      two: projects['Cloud Two']?.initial ?? null,
    };
  }).toEqual({
    names: ['Cloud One', 'Cloud Two'],
    one: 1234,
    two: 8888,
  });

  await desktopToolbar(page).getByLabel('Open project library').click();
  await page.locator('.mobile-library-saved-open').filter({ hasText: 'Cloud One' }).click();
  await expect(quickInputs(page).first()).toHaveValue('1,234');
  await expect(page).toHaveTitle('NPV Lab | Cloud One');

  expect(page.supabaseRequests).toEqual([]);
});
