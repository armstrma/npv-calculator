import { expect, test } from '@playwright/test';

const desktopToolbar = (page) => page.locator('.mobile-topbar-shell-desktop');
const quickInputs = (page) => page.locator('.quick-view-controls input[type="text"]');
const field = (page, key) => page.locator(`.quick-view-controls [data-lock-field="${key}"]`);
const fieldInput = (page, key) => field(page, key).locator('input[type="text"]');
const fieldSlider = (page, key) => field(page, key).locator('input[type="range"]');
const fieldSliderTooltip = (page, key) => field(page, key).locator('.locked-slider-wrap');
const testSessionHash = '#access_token=test-token&refresh_token=refresh-token&expires_in=3600&token_type=bearer';

const PRO_LINK = '/?initial=50000&discount=9&cashflows=5000,6000,7000,8000,9000,10000,11000,12000,13000,14000&currency=%24&period=months&rateBasis=annual&hurdleEnabled=true&hurdleRate=11';
const LOCK_LINK = '/?initial=1000&discount=10&cashflows=300,400,500&currency=%24&period=years&rateBasis=annual&hurdleEnabled=false&v=2&lock=initial,discount,cf1&hide=sensitivity,export,presentation,sliderColors';

const AUTHOR_MESSAGE = 'Locked by the author of this scenario.';

const readStorage = (page, key) => page.evaluate((storageKey) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || 'null');
  } catch {
    return null;
  }
}, key);

const mockProUser = async (page) => {
  await page.route('**/auth/v1/user', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'user-1', email: 'test@example.com' }) }));
  await page.route('**/rest/v1/user_entitlements**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ pro_enabled: true, source: 'e2e' }]) }));
  await page.route('**/rest/v1/user_projects**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('free user opening a Pro link keeps every shared value, with periods 6+ and the hurdle read-only', async ({ page }) => {
  await page.goto(PRO_LINK);

  await expect(quickInputs(page)).toHaveCount(12);
  await expect(fieldInput(page, 'initial')).toHaveValue('50,000');
  await expect(fieldInput(page, 'initial')).toBeEnabled();
  await expect(fieldInput(page, 'rate')).toHaveValue('11.0');
  await expect(fieldInput(page, 'rate')).toBeDisabled();
  for (let i = 0; i < 5; i += 1) await expect(fieldInput(page, `cf${i}`)).toBeEnabled();
  for (let i = 5; i < 10; i += 1) {
    await expect(fieldInput(page, `cf${i}`)).toBeDisabled();
    await expect(fieldSlider(page, `cf${i}`)).toBeDisabled();
  }
  await expect(fieldInput(page, 'cf9')).toHaveValue('14,000');
  await expect(field(page, 'cf0')).toContainText('Month 1');
  await expect(page.getByText('Applied monthly')).toBeVisible();
  await expect(page.locator('.scenario-banner')).toContainText('Pro settings are read-only on the free plan');
  await expect(page.locator('.quick-view-controls button[aria-label^="Remove"]')).toHaveCount(0);

  // Tier-lock tooltip sits on the slider with the upgrade message.
  const tooltip = fieldSliderTooltip(page, 'cf5');
  await expect(tooltip).toHaveAttribute('data-lock-reason', 'tier');
  await expect(tooltip).toHaveAttribute('data-tooltip', /Upgrade to edit longer horizons/);

  // Demo visuals stay off: Pro tabs keep their PRO badge.
  await expect(page.locator('.quick-view-stage-tab', { hasText: 'Cash Flows' }).locator('.pro-texture-badge')).toBeVisible();

  // Edit an allowed period, then reload: nothing is trimmed.
  await fieldInput(page, 'cf0').fill('5555');
  await fieldInput(page, 'cf0').blur();
  await expect.poll(async () => (await readStorage(page, 'npvWorkingDraft'))?.model?.cashflows?.[0] ?? null).toBe(5555);
  await page.reload();
  await expect(quickInputs(page)).toHaveCount(12);
  await expect(fieldInput(page, 'cf0')).toHaveValue('5,555');
  await expect(fieldInput(page, 'cf9')).toBeDisabled();
  await expect(fieldInput(page, 'rate')).toHaveValue('11.0');
  await expect(page.getByText('Applied monthly')).toBeVisible();
});

test('free shared view blocks saving a Pro model and Reset to Defaults leaves the link', async ({ page }) => {
  await page.goto(PRO_LINK);
  await expect(quickInputs(page)).toHaveCount(12);

  await desktopToolbar(page).getByLabel('Save options').click();
  await desktopToolbar(page).getByRole('button', { name: 'Save Locally' }).click();
  await desktopToolbar(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('This shared model uses Pro settings')).toBeVisible();
  await page.reload();
  await expect(quickInputs(page)).toHaveCount(12);

  await desktopToolbar(page).getByLabel('More options').click();
  await desktopToolbar(page).getByRole('button', { name: 'Reset to Defaults' }).click();
  await expect(quickInputs(page)).toHaveCount(7);
  await expect(fieldInput(page, 'initial')).toHaveValue('1,000');
  await expect(page.locator('.scenario-banner')).toHaveCount(0);
  expect(await readStorage(page, 'npvLinkSession')).toBeNull();
});

test('Pro user opening the same link can edit everything', async ({ page }) => {
  await mockProUser(page);
  await page.goto(`${PRO_LINK}${testSessionHash}`);
  await expect(quickInputs(page)).toHaveCount(12);
  await expect(fieldInput(page, 'cf9')).toBeEnabled();
  await expect(fieldInput(page, 'rate')).toBeEnabled();
  await expect(page.locator('.scenario-banner')).toHaveCount(0);
  await expect(page.locator('.locked-slider-wrap')).toHaveCount(0);
});

test('lock link enforces author locks and hides features', async ({ page }) => {
  await page.goto(LOCK_LINK);

  await expect(fieldInput(page, 'initial')).toHaveValue('1,000');
  await expect(fieldInput(page, 'initial')).toBeDisabled();
  await expect(fieldSlider(page, 'initial')).toBeDisabled();
  await expect(fieldInput(page, 'rate')).toBeDisabled();
  await expect(fieldInput(page, 'cf1')).toBeDisabled();
  await expect(fieldInput(page, 'cf0')).toBeEnabled();
  await expect(fieldInput(page, 'cf2')).toBeEnabled();
  await expect(page.locator('.quick-view-controls button[aria-label^="Remove"]')).toHaveCount(0);
  await expect(page.locator('.quick-view-add-space')).toHaveCount(0);

  const tooltip = fieldSliderTooltip(page, 'initial');
  await expect(tooltip).toHaveAttribute('data-lock-reason', 'author');
  await expect(tooltip).toHaveAttribute('data-tooltip', AUTHOR_MESSAGE);
  await expect(page.locator('.scenario-banner')).toContainText('set by the author');

  // Hidden features are absent.
  await expect(page.locator('.quick-view-stage-control', { hasText: 'Sensitivity' })).toHaveCount(0);
  await desktopToolbar(page).getByLabel('Share options').click();
  await expect(desktopToolbar(page).getByRole('button', { name: 'Copy Project Link' })).toBeVisible();
  await expect(desktopToolbar(page).getByRole('button', { name: /Export XLSX/ })).toHaveCount(0);
  await expect(desktopToolbar(page).getByRole('button', { name: /Presentation Mode/ })).toHaveCount(0);
});

test('lock link autosaves to its own slot, resets to the scenario, and exits back to the normal draft', async ({ page }) => {
  // Build normal work through the UI so the page's own autosave owns the draft.
  await page.goto('/');
  await fieldInput(page, 'initial').fill('5555');
  await fieldInput(page, 'initial').blur();
  await expect.poll(async () => (await readStorage(page, 'npvWorkingDraft'))?.model?.initial ?? null).toBe(5555);

  await page.goto(LOCK_LINK);
  await fieldInput(page, 'cf0').fill('999');
  await fieldInput(page, 'cf0').blur();
  await page.waitForTimeout(600);

  // Normal draft untouched.
  expect((await readStorage(page, 'npvWorkingDraft'))?.model?.initial).toBe(5555);

  await page.reload();
  await expect(fieldInput(page, 'cf0')).toHaveValue('999');
  await expect(fieldInput(page, 'initial')).toBeDisabled();

  // Reopening the same link resumes the scenario's own autosave.
  await page.goto(LOCK_LINK);
  await expect(fieldInput(page, 'cf0')).toHaveValue('999');

  await desktopToolbar(page).getByLabel('More options').click();
  await desktopToolbar(page).getByRole('button', { name: 'Reset to Scenario' }).click();
  await expect(fieldInput(page, 'cf0')).toHaveValue('300');
  await expect(fieldInput(page, 'initial')).toBeDisabled();

  await page.getByRole('button', { name: 'Exit scenario' }).click();
  await expect(fieldInput(page, 'initial')).toHaveValue('5,555');
  await expect(fieldInput(page, 'initial')).toBeEnabled();
  await expect(page.locator('.scenario-banner')).toHaveCount(0);
  await page.reload();
  await expect(fieldInput(page, 'initial')).toHaveValue('5,555');
});

test('copying a link from a scenario keeps its locks and stays unnamed', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { window.__copiedText = text; } },
    });
  });
  await page.goto(LOCK_LINK);
  await desktopToolbar(page).getByLabel('Share options').click();
  await desktopToolbar(page).getByRole('button', { name: 'Copy Project Link' }).click();
  const copied = new URL(await page.evaluate(() => window.__copiedText));
  expect(copied.searchParams.get('v')).toBe('2');
  expect(copied.searchParams.get('lock')).toBe('initial,discount,cf1');
  expect(copied.searchParams.get('hide')).toBe('sensitivity,export,presentation,sliderColors');
  expect(copied.searchParams.get('project')).toBeNull();
});

test('example preview shows its tier-lock tooltip on the slider', async ({ page }) => {
  await page.goto('/?example=equipment-purchase');
  await expect(fieldInput(page, 'cf0')).toBeEnabled();
  await expect(fieldInput(page, 'cf1')).toBeDisabled();
  const tooltip = fieldSliderTooltip(page, 'cf1');
  await expect(tooltip).toHaveAttribute('data-lock-reason', 'tier');
  await expect(tooltip).toHaveAttribute('data-tooltip', /Upgrade to premium/);
  await field(page, 'cf1').hover();
  await expect.poll(() => tooltip.evaluate((node) => getComputedStyle(node, '::after').opacity)).toBe('1');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('lock link and free Pro link are enforced on the mobile panel', async ({ page }) => {
    await page.goto(LOCK_LINK);
    await expect(fieldInput(page, 'initial')).toBeDisabled();
    await expect(fieldInput(page, 'cf1')).toBeDisabled();
    await expect(fieldInput(page, 'cf0')).toBeEnabled();

    await page.goto(PRO_LINK);
    await expect(quickInputs(page)).toHaveCount(12);
    await expect(fieldInput(page, 'cf4')).toBeEnabled();
    await expect(fieldInput(page, 'cf5')).toBeDisabled();
  });
});
