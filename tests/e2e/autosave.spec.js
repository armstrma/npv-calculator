import { expect, test } from '@playwright/test';

const quickInputs = (page) => page.locator('.quick-view-controls input[type="text"]');
const yearOneCashflow = (page) => page.locator('.quick-view-row', { hasText: 'Year 1' }).locator('input[type="text"]');

const readDraft = (page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('npvWorkingDraft') || 'null');
  } catch {
    return null;
  }
});

const clearBrowserState = async (page) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

const sampleDraft = {
  version: 1,
  savedAt: Date.now(),
  model: {
    initial: 5555,
    discount: 9,
    cashflows: [111, 222, 333],
    periodMode: 'years',
    rateBasis: 'annual',
    showHurdleRate: false,
    hurdleRate: 12,
    currency: '$',
    projectName: 'Autosave Draft',
    loadedProjectName: 'Autosave Draft',
    loadedProjectSource: 'scratch',
  },
};

test.beforeEach(async ({ page }) => {
  await clearBrowserState(page);
});

test('restores the working model after a reload', async ({ page }) => {
  await page.goto('/');
  await quickInputs(page).first().fill('5555');
  await quickInputs(page).first().blur();

  await expect.poll(async () => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('npvWorkingDraft') || 'null')?.model?.initial ?? null;
    } catch {
      return null;
    }
  })).toBe(5555);

  await page.reload();

  await expect(quickInputs(page).first()).toHaveValue('5,555');
});

test('shared link values take priority over an existing autosave', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((draft) => {
    localStorage.setItem('npvWorkingDraft', JSON.stringify(draft));
  }, sampleDraft);

  await page.goto('/?initial=7777&discount=8&cashflows=100,200,300&project=Shared%20Link');

  await expect(quickInputs(page).first()).toHaveValue('7,777');
  await expect(page).toHaveTitle('NPV Lab | Shared Link');
  await expect(quickInputs(page).first()).not.toHaveValue('5,555');
});

test('corrupt local project storage is backed up and the app still loads', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('npvProjects', '{not-json');
  });

  await page.reload();

  await expect(quickInputs(page).first()).toBeVisible();
  await expect(quickInputs(page).first()).toHaveValue('1,000');
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('npvProjects.corrupt'))).toBe('{not-json');
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('npvProjects'))).toBeNull();
});

test('error boundary shows reload and reset actions, and reset clears saved data only', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('npvProjects', JSON.stringify({ 'Saved Case': { initial: 1, cashflows: [1] } }));
    localStorage.setItem('npvWorkingDraft', JSON.stringify({ version: 1, model: { initial: 2, cashflows: [2] } }));
    localStorage.setItem('npvLabSupabaseSession', JSON.stringify({ accessToken: 'keep-me' }));
  });

  await page.goto('/?e2e_crash=1');

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset saved data' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset saved data' }).click();

  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  const stored = await page.evaluate(() => ({
    projects: localStorage.getItem('npvProjects'),
    draft: localStorage.getItem('npvWorkingDraft'),
    session: localStorage.getItem('npvLabSupabaseSession'),
  }));
  expect(stored.projects).toBeNull();
  expect(stored.draft).toBeNull();
  expect(stored.session).toBe(JSON.stringify({ accessToken: 'keep-me' }));
});

test('example link edits survive a reload after the example param is cleared', async ({ page }) => {
  await page.goto('/?example=equipment-purchase');

  await expect(quickInputs(page).first()).toHaveValue('68,000');
  await expect(page).toHaveTitle('NPV Lab | Equipment Purchase');
  await expect(page).not.toHaveURL(/example=/);
  await expect(page).not.toHaveURL(/\/examples\//);

  await yearOneCashflow(page).fill('5555');
  await yearOneCashflow(page).blur();

  await expect.poll(async () => (await readDraft(page))?.model?.cashflows?.[0] ?? null).toBe(5555);

  await page.reload();

  await expect(quickInputs(page).first()).toHaveValue('68,000');
  await expect(yearOneCashflow(page)).toHaveValue('5,555');
  await expect(page).toHaveTitle('NPV Lab | Equipment Purchase');
  await expect(page).not.toHaveURL(/example=/);
});

test('shared link edits survive a reload after the share params are cleared', async ({ page }) => {
  await page.goto('/?initial=7777&discount=8&cashflows=100,200,300&project=Shared%20Link');

  await expect(quickInputs(page).first()).toHaveValue('7,777');
  await expect(page).toHaveTitle('NPV Lab | Shared Link');
  await expect(page).not.toHaveURL(/initial=/);

  await quickInputs(page).first().fill('5555');
  await quickInputs(page).first().blur();

  await expect.poll(async () => (await readDraft(page))?.model?.initial ?? null).toBe(5555);

  await page.reload();

  await expect(quickInputs(page).first()).toHaveValue('5,555');
  await expect(page).toHaveTitle('NPV Lab | Shared Link');
  await expect(page).not.toHaveURL(/initial=/);
});

test('shared link values survive a reload even before later edits are typed', async ({ page }) => {
  await page.goto('/?initial=7777&discount=8&cashflows=100,200,300&project=Shared%20Link');
  await expect(quickInputs(page).first()).toHaveValue('7,777');
  await expect(page).not.toHaveURL(/initial=/);

  await page.reload();

  await expect(quickInputs(page).first()).toHaveValue('7,777');
  await expect(page).toHaveTitle('NPV Lab | Shared Link');
});

test('a fresh example or shared link takes priority over an existing working draft', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((draft) => {
    localStorage.setItem('npvWorkingDraft', JSON.stringify(draft));
  }, sampleDraft);

  await page.goto('/?example=equipment-purchase');

  await expect(quickInputs(page).first()).toHaveValue('68,000');
  await expect(quickInputs(page).first()).not.toHaveValue('5,555');
  await expect(page).toHaveTitle('NPV Lab | Equipment Purchase');
  await expect(page).not.toHaveURL(/example=/);

  await page.goto('/examples/small-business-project');

  await expect(quickInputs(page).first()).toHaveValue('92,000');
  await expect(page).toHaveTitle('NPV Lab | Small Business Project');
  await expect(page).not.toHaveURL(/example=/);
  await expect(page).not.toHaveURL(/\/examples\//);

  await page.goto('/?initial=7777&discount=8&cashflows=100,200,300&project=Shared%20Link');

  await expect(quickInputs(page).first()).toHaveValue('7,777');
  await expect(page).toHaveTitle('NPV Lab | Shared Link');
});
