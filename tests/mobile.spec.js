const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('mobile: participant table stacks and bracket shows per-round view', async ({ page }) => {
  await page.goto('/index.html');

  await page.evaluate(() => document.querySelector('#bilpos-main') && 0);
  const hasOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  await page.click('.sidebar-nav-item[data-section="participants"]');
  await expect(page.locator('#section-participants')).toBeVisible();
  await expect(page.locator('#participant-table thead')).toBeHidden();
  expect(await hasOverflow()).toBe(false);

  await page.click('.sidebar-nav-item[data-section="bracket"]');
  await expect(page.locator('.mobile-round-tabs')).toBeVisible();
  await expect(page.locator('.mobile-round-list .match-card').first()).toBeVisible();
  expect(await hasOverflow()).toBe(false);

  await page.click('.mobile-round-nav button:last-child');
  await expect(page.locator('.mobile-round-tab.active')).not.toHaveText(/^$/);

  await page.click('.mobile-view-toggle');
  await expect(page.locator('.bracket-scroll-container')).toBeVisible();
});
