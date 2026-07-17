const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.goto(`file://${path.join(__dirname, 'feature-graphic.html')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'feature-graphic.png') });
  console.log('captured feature-graphic.png');
  await browser.close();
})();
