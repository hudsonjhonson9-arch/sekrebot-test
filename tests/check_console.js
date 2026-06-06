const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGE_ERROR] ${err}`));

  await page.goto('https://absensi.mindcloud.my.id/', { waitUntil: 'networkidle' });
  
  // Wait a bit to see if any periodic loading errors happen
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
