const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL
  || process.env.BASE_URL
  || 'http://localhost:3000';

const adminCredentials = {
  username: process.env.PW_ADMIN_USERNAME || process.env.PW_USERNAME || 'admin',
  password: process.env.PW_ADMIN_PASSWORD || process.env.PW_PASSWORD || 'admin123'
};

const managerCredentials = {
  username: process.env.PW_MANAGER_USERNAME || '',
  password: process.env.PW_MANAGER_PASSWORD || ''
};

const staffCredentials = {
  username: process.env.PW_STAFF_USERNAME || '',
  password: process.env.PW_STAFF_PASSWORD || ''
};

const ensureBaseReachable = async (request) => {
  try {
    const response = await request.get(baseURL, { timeout: 5000 });
    return response.ok();
  } catch {
    return false;
  }
};

const login = async (page, credentials) => {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Enter your username').fill(credentials.username);
  await page.getByPlaceholder('Enter your password').fill(credentials.password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await expect(page).not.toHaveURL(/\/login/);
};

const visitRoutes = async (page, routes) => {
  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
    await expect(page.locator('body')).toBeVisible();
  }
};

test.describe('Full system smoke (admin)', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    const ok = await ensureBaseReachable(request);
    if (!ok) {
      testInfo.skip(`Base URL not reachable: ${baseURL}`);
    }
  });

  test('login and critical routes', async ({ page }) => {
    await login(page, adminCredentials);

    const routes = [
      '/dashboard',
      '/arrivals',
      '/records',
      '/locations',
      '/ledger',
      '/rice-ledger',
      '/hamali',
      '/hamali-book',
      '/admin/users',
      '/pending-approvals',
      '/sample-entry',
      '/rice-sample-entries',
      '/sample-entry-ledger',
      '/cooking-book',
      '/paddy-sample-reports',
      '/manager-sample-reports',
      '/rice-sample-reports',
      '/owner-financial',
      '/manager-financial',
      '/final-review',
      '/sample-workflow',
      '/egb-ledger',
      '/inventory-entry'
    ];

    await visitRoutes(page, routes);
  });
});

test.describe('Full system smoke (manager)', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    const ok = await ensureBaseReachable(request);
    if (!ok) {
      testInfo.skip(`Base URL not reachable: ${baseURL}`);
    }
  });

  test('login and manager routes', async ({ page }, testInfo) => {
    if (!managerCredentials.username || !managerCredentials.password) {
      testInfo.skip('Missing manager credentials. Set PW_MANAGER_USERNAME and PW_MANAGER_PASSWORD.');
    }

    await login(page, managerCredentials);

    const routes = [
      '/dashboard',
      '/arrivals',
      '/records',
      '/locations',
      '/ledger',
      '/rice-ledger',
      '/hamali',
      '/hamali-book',
      '/pending-approvals',
      '/sample-entry',
      '/rice-sample-entries',
      '/sample-entry-ledger',
      '/manager-sample-reports',
      '/rice-sample-reports',
      '/cooking-book',
      '/manager-financial',
      '/final-review',
      '/sample-workflow',
      '/egb-ledger',
      '/allotting-supervisors'
    ];

    await visitRoutes(page, routes);
  });
});

test.describe('Full system smoke (paddy supervisor)', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    const ok = await ensureBaseReachable(request);
    if (!ok) {
      testInfo.skip(`Base URL not reachable: ${baseURL}`);
    }
  });

  test('login and staff routes', async ({ page }, testInfo) => {
    if (!staffCredentials.username || !staffCredentials.password) {
      testInfo.skip('Missing staff credentials. Set PW_STAFF_USERNAME and PW_STAFF_PASSWORD.');
    }

    await login(page, staffCredentials);

    const routes = [
      '/dashboard',
      '/arrivals',
      '/records',
      '/ledger',
      '/rice-ledger',
      '/hamali',
      '/sample-entry',
      '/rice-sample-entries',
      '/sample-entry-ledger',
      '/cooking-book'
    ];

    await visitRoutes(page, routes);
  });
});
