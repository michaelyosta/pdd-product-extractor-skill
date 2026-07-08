#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultProfileDir = path.join(os.homedir(), '.codex', 'pdd-product-profile');
const defaultChromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function usage() {
  return `pdd-product

Usage:
  pdd-product login [--profile .pdd-profile]
  pdd-product fetch <url> [--format json|markdown] [--out file] [--profile .pdd-profile] [--headful]

Examples:
  npm run pdd -- login
  npm run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --format markdown
  npm run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --out product.json
`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    if (key === 'headful' || key === 'help') {
      args[key] = true;
      continue;
    }
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

function chromeExecutable() {
  if (fs.existsSync(defaultChromePath)) return defaultChromePath;
  const x86 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(x86)) return x86;
  throw new Error('Chrome executable not found. Install Chrome or edit defaultChromePath in bin/pdd-product.js.');
}

async function openContext({ profileDir, headless }) {
  const { chromium } = await import('playwright-core');
  fs.mkdirSync(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable(),
    headless,
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

function normalizeUrl(input) {
  const url = new URL(input);
  if (url.hostname === 'mobile.pinduoduo.com') url.hostname = 'mobile.yangkeduo.com';
  return url;
}

function commentsUrl(productUrl) {
  const url = normalizeUrl(productUrl);
  url.pathname = '/goods_comments.html';
  return url.toString();
}

function extractGoodsId(input) {
  try {
    const url = normalizeUrl(input);
    return url.searchParams.get('goods_id') || null;
  } catch {
    return null;
  }
}

function cleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return null;
}

function parsePrice(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === '¥' && /^[0-9]+(?:\.[0-9]+)?$/.test(lines[i + 1] || '')) return `¥${lines[i + 1]}`;
    const direct = lines[i].match(/^¥\s*([0-9]+(?:\.[0-9]+)?)/);
    if (direct) return `¥${direct[1]}`;
  }
  return null;
}

function parseProductPage(text, url, images) {
  const lines = cleanLines(text);
  const deliveryIndex = lines.findIndex((line) => /预计.*送达|Ожидаемая доставка/i.test(line));
  const title =
    deliveryIndex >= 0 && lines[deliveryIndex + 1] && !/人在拼|参与|В групповой/.test(lines[deliveryIndex + 1])
      ? lines[deliveryIndex + 1]
      : firstMatch(text, [
          /送达\s*\n([^\n]{12,})/,
          /Ожидаемая доставка[^\n]*\n([^\n]{12,})/,
        ]);

  const reviewCount = firstMatch(text, [/商品评价\(([\d,，.]+)\)/, /Отзывы о товаре \(([\d,，.]+)\)/]);
  const storeStart = lines.findIndex((line) => /瑞星辰|Ruixingchen/i.test(line));
  const details = {};
  for (const line of lines) {
    const pairs = [
      ['shipFrom', /^(?:发货地|Место отгрузки)(.+)$/],
      ['material', /^(?:材质|Материал)(.+)$/],
      ['features', /^(?:功能特点|Функции)(.+)$/],
      ['finish', /^(?:表面工艺|Обработка поверхности)(.+)$/],
    ];
    for (const [key, pattern] of pairs) {
      const match = line.match(pattern);
      if (match) details[key] = match[1].trim();
    }
  }

  return {
    url,
    goodsId: extractGoodsId(url),
    title,
    price: parsePrice(lines),
    sold: firstMatch(text, [/已拼([^\n]+件)/, /приобретено более ([^\n.]+товаров)/i]),
    coupon: lines.find((line) => /满\d+减\d+|Скидка/.test(line)) || null,
    delivery: lines.find((line) => /预计.*送达|Ожидаемая доставка/i.test(line)) || null,
    protections: lines.filter((line) => /7天无理由|48小时发货|全场包邮|возврат|Отправка|Бесплатная доставка/i.test(line)),
    reviewCount,
    storeName: storeStart >= 0 ? lines[storeStart] : null,
    storeSold: firstMatch(text, [/本店已拼([^\n]+件)/, /магазине уже продано более ([^\n.]+товаров)/i]),
    details,
    images: images.filter((src) => /mms-material-img/.test(src)).slice(0, 12),
  };
}

function assertProductPage(raw) {
  const url = raw.url || '';
  const text = raw.text || '';
  if (/\/psnl_verification\.html/.test(url) || /VerifyAuthToken=/.test(url)) {
    throw new Error(
      'Pinduoduo opened a personal verification page. Run login/headful with the same profile, complete verification, close Chrome, then retry fetch.'
    );
  }
  if (/登录|扫码登录|手机登录/.test(text)) {
    throw new Error(`Product page requires login.`);
  }
}

function parseTags(lines) {
  const tags = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/([^()\n]{2,30})[（(]([0-9,，.]+)[）)]/g)];
    for (const match of matches) {
      const label = match[1].replace(/[]/g, '').trim();
      if (label && !/全部|Всего/.test(label)) tags.push({ label, count: match[2].replace(/，/g, ',') });
    }
  }
  return tags;
}

function parseComments(text) {
  const lines = cleanLines(text);
  const total = firstMatch(text, [/全部[（(]([0-9,，.]+)[）)]/, /Всего [（(]([0-9,，.]+)[）)]/]);
  const mediaCount = firstMatch(text, [/图片\/视频[（(]([0-9,，.]+)[）)]/, /Изображение\/Видео [（(]([0-9,，.]+)[）)]/]);
  const imperfectCount = firstMatch(text, [/不完美[（(]([0-9,，.]+)[）)]/, /Несовершенный [（(]([0-9,，.]+)[）)]/]);
  const tags = parseTags(lines);

  const comments = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^(款式|类型|型号|Стиль|Тип|Модель):/.test(lines[i])) continue;
    const user = lines[i - 1] || null;
    const variant = lines[i];
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^(赞|хвалить|Комментарий|评论|Более|更多)$/.test(lines[j])) break;
      if (/^(款式|类型|型号|Стиль|Тип|Модель):/.test(lines[j])) break;
      body.push(lines[j]);
    }
    if (body.length) comments.push({ user, variant, text: body.join(' ') });
    if (comments.length >= 20) break;
  }

  return { total, mediaCount, imperfectCount, tags, comments };
}

async function readPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  return page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: document.body ? document.body.innerText : '',
    images: [...document.images].map((img) => img.currentSrc || img.src).filter(Boolean),
  }));
}

async function login(args) {
  const profileDir = path.resolve(args.profile || defaultProfileDir);
  const context = await openContext({ profileDir, headless: false });
  const page = await context.newPage();
  await page.goto('https://mobile.yangkeduo.com/', { waitUntil: 'domcontentloaded' });
  console.log(`Chrome opened with profile: ${profileDir}`);
  console.log('Log in to Pinduoduo in the opened window, then press Enter here to close the browser.');
  await new Promise((resolve) => process.stdin.once('data', resolve));
  await context.close();
}

async function fetchProduct(args) {
  const inputUrl = args._[1];
  if (!inputUrl) throw new Error('Missing product URL.');
  const profileDir = path.resolve(args.profile || defaultProfileDir);
  const format = args.format || 'json';
  const headless = !args.headful;

  const context = await openContext({ profileDir, headless });
  const page = await context.newPage();
  try {
    const productRaw = await readPage(page, inputUrl);
    try {
      assertProductPage(productRaw);
    } catch (error) {
      if (error.message === 'Product page requires login.') {
        throw new Error(`Product page requires login. Run: npm run pdd -- login --profile "${profileDir}"`);
      }
      throw error;
    }
    const product = parseProductPage(productRaw.text, productRaw.url, productRaw.images);
    if (!product.title && !product.price && !product.reviewCount && product.images.length === 0) {
      throw new Error('Product data was not extracted. The page may be blocked, translated unexpectedly, or still loading.');
    }

    const commentsRaw = await readPage(page, commentsUrl(productRaw.url));
    const comments = parseComments(commentsRaw.text);
    comments.imperfectComments = await readImperfectComments(page);
    const result = {
      fetchedAt: new Date().toISOString(),
      product,
      comments,
      rawText: args.raw ? { product: productRaw.text, comments: commentsRaw.text } : undefined,
    };

    const output = format === 'markdown' ? toMarkdown(result) : JSON.stringify(result, null, 2);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), output, 'utf8');
      console.error(`Saved: ${path.resolve(args.out)}`);
    } else {
      console.log(output);
    }
  } finally {
    await context.close();
  }
}

async function readImperfectComments(page) {
  const imperfect = page.locator('text=/不完美|Несовершенный/');
  if ((await imperfect.count()) < 1) return [];
  await imperfect.first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
  return parseComments(text).comments;
}

function toMarkdown(data) {
  const p = data.product;
  const c = data.comments;
  const details = Object.entries(p.details || {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
  const tags = (c.tags || [])
    .slice(0, 15)
    .map((tag) => `- ${tag.label}: ${tag.count}`)
    .join('\n');
  const comments = (c.comments || [])
    .slice(0, 8)
    .map((comment) => `- ${comment.user || 'user'} (${comment.variant}): ${comment.text}`)
    .join('\n');

  return `# Pinduoduo Product Review Data

- URL: ${p.url}
- Goods ID: ${p.goodsId || ''}
- Title: ${p.title || ''}
- Price: ${p.price || ''}
- Sold: ${p.sold || ''}
- Coupon: ${p.coupon || ''}
- Delivery: ${p.delivery || ''}
- Store: ${p.storeName || ''}
- Store sold: ${p.storeSold || ''}
- Reviews: ${p.reviewCount || c.total || ''}
- Media reviews: ${c.mediaCount || ''}
- Imperfect reviews: ${c.imperfectCount || ''}

## Details
${details || '- No details extracted'}

## Review Tags
${tags || '- No tags extracted'}

## Visible Comments
${comments || '- No comments extracted'}

## Images
${(p.images || []).map((src) => `- ${src}`).join('\n') || '- No product images extracted'}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (args.help || !command) {
    console.log(usage());
    return;
  }
  if (command === 'login') return login(args);
  if (command === 'fetch') return fetchProduct(args);
  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
