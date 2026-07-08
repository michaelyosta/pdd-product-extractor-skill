---
name: pdd-product-extractor
description: Extract structured product, price, image, store, specification, and review-signal data from Pinduoduo/Yangkeduo product links such as mobile.yangkeduo.com/goods2.html. Use when a user asks to review a Pinduoduo product, summarize Chinese marketplace reviews, compare review sentiment, get product metadata from a PDD/Yangkeduo URL, or avoid repeated manual browser scraping of authenticated Pinduoduo pages.
---

# PDD Product Extractor

## Overview

Use the bundled CLI before manually driving a browser. It opens the product page with a persistent Chrome profile, extracts rendered page text, visits the comments page, and returns compact JSON or Markdown for analysis.

The CLI is read-only. It does not buy, add to cart, send messages, or submit forms.

## Quick Start

Run commands from the skill folder:

```powershell
cd C:\Users\misa\.codex\skills\pdd-product-extractor
```

Install dependencies if `node_modules` is missing or `playwright-core` cannot be imported:

```powershell
npm.cmd install
```

For first-time use, authenticate once:

```powershell
npm.cmd run pdd -- login
```

Chrome opens with a persistent profile at `~\.codex\pdd-product-profile`. Ask the user to log in if the page requires it. After login, they press Enter in the terminal to close Chrome.

Fetch a product as Markdown:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --format markdown --out product.md
```

Fetch as JSON:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --out product.json
```

If headless Chrome is blocked or returns a login shell despite prior login, retry visibly:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --headful --format markdown
```

If Pinduoduo opens `psnl_verification.html`, run an interactive verification pass:

```powershell
npm.cmd run pdd -- verify "https://mobile.yangkeduo.com/goods2.html?ps=..."
```

Ask the user to complete the captcha/security check in Chrome, then press Enter in the terminal so the CLI closes Chrome cleanly and persists the profile.

## Workflow

1. Prefer `scripts/pdd-product.js` for extraction instead of repeated Chrome interaction.
2. If `fetch` says login is required, run `login` and ask the user to complete authentication in the opened Chrome window.
3. If `fetch` says personal verification is required, run `verify <url>`, have the user solve the Pinduoduo captcha/security check, and wait for Enter before retrying `fetch`.
4. If Chrome cannot start with the profile, ask the user to close any Chrome window using `~\.codex\pdd-product-profile`.
5. Use the generated Markdown for a human-facing review. Use JSON when another tool or agent will consume the data.
6. Treat the extracted data as marketplace claims and user-review signals, not verified lab measurements.
7. Mention data limits when relevant: Pinduoduo can translate text in Chrome, reorder visible reviews, or hide deeper comments behind dynamic loading.

## Output Fields

The script attempts to extract:

- product URL, goods id, title, price, sold count, coupon, delivery text
- availability and unavailable/sold-out reason when Pinduoduo no longer shows a buyable product page
- protections such as return, dispatch, and free-shipping claims
- store name and store sales count
- product details such as shipping origin, material, features, finish
- product image URLs
- total review count, media-review count, review tags
- first visible comments
- comments under the `不完美` / `Несовершенный` tag when present

## Review Guidance

When writing the final review:

- Separate hard facts from review sentiment.
- Call out repeated positive tags, photo/video review volume, and negative-tag volume.
- Read `comments.imperfectComments` first when the user asks about risks or complaints.
- Be skeptical of repetitive enthusiastic comments; Pinduoduo review text can be templated or translated.
- Avoid exposing private user identifiers from review text unless necessary; summarize instead.
