const { chromium } = require('playwright');
const path = require('path');

const files = ['1-empty', '2-recording', '3-finished', '4-organized'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const name of files) {
    const filePath = path.join(__dirname, `${name}.html`);
    await page.goto(`file://${filePath}`);
    await page.evaluate(() => document.fonts.ready);
    // Icon webfonts (Phosphor) sometimes finish a beat after document.fonts.ready
    // resolves for the primary text font - a short fixed wait covers that.
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(__dirname, `${name}.png`) });
    console.log(`captured ${name}.png`);
  }
  await browser.close();
})();
