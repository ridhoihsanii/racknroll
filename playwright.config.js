// Playwright config for Bilpos E2E smoke tests
/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests',
  timeout: 120000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 30000,
    baseURL: 'http://127.0.0.1:8080'
  },
  projects: [
    { name: 'desktop' },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  reporter: [['list']]
};