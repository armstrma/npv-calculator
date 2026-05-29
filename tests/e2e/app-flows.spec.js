import { expect, test } from '@playwright/test';

const desktopToolbar = (page) => page.locator('.mobile-topbar-shell-desktop');
const quickInputs = (page) => page.locator('.quick-view-controls input[type="text"]');

const clearBrowserState = async (page) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

const mockSignedInUser = async (page) => {
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-1', email: 'test@example.com' }),
    });
  });
  await page.route('**/rest/v1/user_entitlements**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ pro_enabled: false, source: null }]),
    });
  });
  await page.route('**/rest/v1/user_projects**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
};

test.beforeEach(async ({ page }) => {
  await clearBrowserState(page);
});

test('saves and reloads a local project through the UI', async ({ page }) => {
  await page.goto('/');
  await quickInputs(page).first().fill('1234');
  await quickInputs(page).first().blur();

  await desktopToolbar(page).getByLabel('Save options').click();
  await page.getByRole('button', { name: 'Save Locally' }).click();
  await page.getByLabel('Project name').fill('E2E Local Project');
  await page.getByRole('button', { name: 'Save Locally' }).click();
  await expect(page.getByText('E2E Local Project')).toBeHidden();

  await quickInputs(page).first().fill('9999');
  await quickInputs(page).first().blur();
  await expect(quickInputs(page).first()).toHaveValue('9,999');

  await desktopToolbar(page).getByLabel('Open project library').click();
  await page.locator('.mobile-library-saved-open').filter({ hasText: 'E2E Local Project' }).click();

  await expect(quickInputs(page).first()).toHaveValue('1,234');
});

test('cloud save requires authentication before opening the cloud save dialog', async ({ page }) => {
  await page.goto('/');

  await desktopToolbar(page).getByLabel('Save options').click();
  await page.getByRole('button', { name: 'Sign In to Save to Cloud' }).click();

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await expect(page.getByText('Use a passwordless account')).toBeVisible();
});

test('deep links hydrate project values and title', async ({ page }) => {
  await page.goto('/?initial=3210&discount=7.5&cashflows=400,500,600&project=Deep%20Link%20Project&period=quarters&rateBasis=annual');

  await expect(page).toHaveTitle('NPV Lab | Deep Link Project');
  await expect(quickInputs(page).first()).toHaveValue('3,210');
  await expect(page.getByText('Quarter 1')).toBeVisible();
  await expect(page.locator('.quick-view-controls')).toContainText('Annual Discount Rate');
  await expect(page.locator('.quick-view-controls')).toContainText('Applied quarterly: 1.82%');
});

test('monthly projects apply annual discount rates as converted monthly rates', async ({ page }) => {
  await page.goto('/?initial=1000&discount=12&cashflows=100,100,100&period=months&rateBasis=annual');

  await expect(page.locator('.quick-view-controls')).toContainText('Annual Discount Rate');
  await expect(page.locator('.quick-view-controls')).toContainText('Applied monthly: 0.95%');
  await expect(page.locator('.quick-view-metrics-header')).toContainText('$-705.60');
});

test('yearly projects keep annual rate assumptions implicit', async ({ page }) => {
  await page.goto('/?initial=1000&discount=12&cashflows=400,400,400&period=years&rateBasis=annual');

  await expect(page.locator('.quick-view-controls')).toContainText('Discount Rate');
  await expect(page.locator('.quick-view-controls')).not.toContainText('Annual Discount Rate');
  await expect(page.locator('.quick-view-controls')).not.toContainText('Applied annually');
  await expect(page.locator('.quick-view-stage-heading h2').first()).toHaveText('NPV vs Discount Rate');
});

test('checkout failure is shown after a signed-in user starts checkout', async ({ page }) => {
  await mockSignedInUser(page);
  await page.route('**/api/create-shopify-checkout', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Checkout unavailable in test' }),
    });
  });

  await page.goto('/?signedIn=e2e#access_token=test-token&refresh_token=refresh-token&expires_in=3600&token_type=bearer');
  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByText('test@example.com').last()).toBeVisible();
  await page.getByRole('button', { name: 'More options' }).click();

  await page.getByRole('button', { name: 'Upgrade' }).click();
  await page.getByRole('button', { name: /Monthly/ }).click();

  await expect(page.getByText('Checkout unavailable in test')).toBeVisible();
});

test('edge-case calculations render non-numeric IRR without fake precision', async ({ page }) => {
  await page.goto('/?initial=1000&discount=10&cashflows=-100,-100&project=No%20Root');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('.quick-view-analysis-facts-list')).toContainText('IRR');
  await expect(page.locator('.quick-view-analysis-facts-list')).toContainText('N/A');
  await page.getByRole('button', { name: /Spread/ }).click();
  await expect(page.locator('.quick-view-analysis-detail')).toContainText('No discount rate');

  await page.goto('/?initial=1000&discount=10&cashflows=2300,-1320&project=Multiple%20Roots');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('.quick-view-analysis-facts-list')).toContainText('N/A');
  await page.getByRole('button', { name: /Spread/ }).click();
  await expect(page.locator('.quick-view-analysis-detail')).toContainText('Multiple IRR roots');

  await page.goto('/?initial=0&discount=10&cashflows=200,300,400&project=Zero%20Initial');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('.quick-view-analysis-decision')).toContainText('Accept');
  await expect(page.locator('.quick-view-analysis-facts-list')).toContainText('N/A');
  await page.getByRole('button', { name: /Spread/ }).click();
  await expect(page.locator('.quick-view-analysis-detail')).toContainText('IRR is not meaningful');
});
