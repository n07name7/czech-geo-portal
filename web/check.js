const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.toString()));
  await page.goto('http://localhost:3000/cs/map');
  try {
    await page.waitForSelector('.maplibregl-canvas', {timeout: 10000});
    console.log('MAP RENDERED SUCCESSFULLY');
  } catch (e) {
    console.log('MAP FAILED TO RENDER');
  }
  await browser.close();
})();
