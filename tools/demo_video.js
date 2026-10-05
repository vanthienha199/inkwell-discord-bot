// Builds demo.mp4: the real Discord captures in order, each with a one-line caption, in the Inkwell & Nib palette.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const slides = [
  ['setup.png', 'One command sets up the channels, roles and the mod log', 'left bottom'],
  ['welcome.png', 'New members get a welcome card with links to the rules and help desk', 'left 60%'],
  ['role_menu.png', 'They pick the topics they care about from a menu', 'left 60%'],
  ['role_done.png', 'The bot gives them the matching roles', 'left bottom'],
  ['helpdesk.png', 'Anyone can open a private ticket from the help desk', 'left bottom'],
  ['ticket_open.png', 'A moderator replies and claims it in the same thread', 'left 40%'],
  ['ticket_closed.png', 'Closing locks the thread and saves a transcript', 'left 60%'],
  ['modlog.png', 'Every claim and close lands in a private mod log', 'left 40%'],
  ['empty_warnings.png', 'Moderation commands, here a member with a clean record', 'left bottom'],
  ['error_timeout.png', 'Clear errors when the bot is not allowed to act', 'left bottom'],
];

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-video-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const frames = [];
  for (const [i, [file, caption, pos]] of slides.entries()) {
    const img = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'raw', file)).toString('base64');
    await page.setContent(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;700&display=swap">
      <style>html,body{margin:0;width:1280px;height:720px;background:#17151C;font-family:Rubik,sans-serif;color:#ECEAF0;overflow:hidden}
      .shot{position:absolute;inset:0 0 96px 0;background:url(${img}) ${pos}/cover no-repeat}
      .cap{position:absolute;left:0;right:0;bottom:0;height:96px;display:flex;align-items:center;gap:20px;padding:0 48px;background:#211E27;border-top:2px solid #7CE0B0}
      .n{font-weight:700;color:#7CE0B0;font-size:22px}.t{font-size:26px}</style>
      <div class="shot"></div><div class="cap"><span class="n">${i + 1} of ${slides.length}</span><span class="t">${caption}</span></div>`);
    await page.waitForTimeout(500);
    const out = path.join(tmp, `s${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: out });
    frames.push(out);
  }
  await browser.close();

  const per = 4;
  const inputs = frames.flatMap((f) => ['-loop', '1', '-t', String(per), '-i', f]);
  let filter = '';
  let last = '[0:v]';
  for (let i = 1; i < frames.length; i++) {
    const out = i === frames.length - 1 ? '[v]' : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=0.3:offset=${(per - 0.3) * i}${out};`;
    last = out;
  }
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter.slice(0, -1), '-map', '[v]', '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '24', path.join(root, 'demo.mp4')]);
  console.log('demo.mp4 written,', frames.length, 'slides');
})();
