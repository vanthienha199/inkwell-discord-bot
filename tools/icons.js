// Renders the Inkwell & Nib server icon and the Inkwell Helper bot avatar: a pen nib, mint on the club's dark ink.
const { chromium } = require('playwright');
const path = require('path');

const nib = (fill, cut) => `
  <path d="M256 70 L356 250 Q366 270 352 290 L270 430 Q256 452 242 430 L160 290 Q146 270 156 250 Z" fill="${fill}"/>
  <circle cx="256" cy="250" r="26" fill="${cut}"/>
  <rect x="250" y="270" width="12" height="150" rx="6" fill="${cut}"/>`;

const files = {
  'server-icon.png': `<rect width="512" height="512" fill="#17151C"/>${nib('#7CE0B0', '#17151C')}`,
  'avatar.png': `<rect width="512" height="512" fill="#7CE0B0"/>${nib('#17151C', '#7CE0B0')}`,
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  for (const [name, body] of Object.entries(files)) {
    await page.setContent(`<style>html,body{margin:0}</style><svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    await page.screenshot({ path: path.join(__dirname, '..', 'assets', name) });
  }
  await browser.close();
})();
