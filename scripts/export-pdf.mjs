/**
 * Renders an HTML file to a text-selectable PDF using the copy of Chrome
 * already installed on this machine. No dependencies, no print dialog,
 * no browser headers/footers.
 *
 * Paths are resolved against the repo root, not this file, so it can be run
 * from anywhere:
 *
 *   node scripts/export-pdf.mjs                              -> resume.html
 *   node scripts/export-pdf.mjs portfolio.html portfolio.pdf -> anything else
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [sourceArg, outputArg] = process.argv.slice(2);
const SOURCE = join(root, sourceArg ?? 'resume.html');
const OUTPUT = join(root, outputArg ?? 'Thanapat_Aupprathumwipanon_Resume.pdf');
// Only the resume is supposed to be one page; a portfolio is meant to run long.
const EXPECT_SINGLE_PAGE = !sourceArg;

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

const chromePath = process.env.CHROME_PATH || CHROME_CANDIDATES.find(existsSync);
if (!chromePath) {
  console.error('Could not find Chrome. Set CHROME_PATH to the browser executable.');
  process.exit(1);
}

const browser = spawn(chromePath, [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=0',
  `--user-data-dir=${join(root, '.chrome-export-profile')}`,
  'about:blank',
]);

const endpoint = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Chrome did not start in time.')), 30000);
  let buffer = '';
  browser.stderr.on('data', (chunk) => {
    buffer += chunk;
    const match = buffer.match(/ws:\/\/[^\s]+/);
    if (match) {
      clearTimeout(timer);
      resolve(match[0]);
    }
  });
});

const socket = new WebSocket(endpoint);
const pending = new Map();
let nextId = 0;

socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const resolver = pending.get(message.id);
  if (!resolver) return;
  pending.delete(message.id);
  message.error ? resolver.reject(new Error(message.error.message)) : resolver.resolve(message.result);
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

await new Promise((resolve) => { socket.onopen = resolve; });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

const sendToPage = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });

await sendToPage('Page.enable');

const loaded = new Promise((resolve) => {
  const listener = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Page.loadEventFired') {
      socket.removeEventListener('message', listener);
      resolve();
    }
  };
  socket.addEventListener('message', listener);
});

await sendToPage('Page.navigate', { url: pathToFileURL(SOURCE).href });
await loaded;
await sendToPage('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });

const { data } = await sendToPage('Page.printToPDF', {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
});

const pdf = Buffer.from(data, 'base64');
writeFileSync(OUTPUT, pdf);

const pages = Number(pdf.toString('latin1').match(/\/Count\s+(\d+)/)?.[1] ?? 1);
console.log(`Wrote ${OUTPUT} (${pages} page${pages === 1 ? '' : 's'})`);
if (pages > 1 && EXPECT_SINGLE_PAGE) {
  console.log('Heads up: the resume no longer fits on one page. Trim a bullet, or');
  console.log('lower the `font-size` in the `@media print` block of resume.html.');
}

socket.close();
browser.kill();
process.exit(0);
