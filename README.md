# PDD Product Extractor Skill

Codex skill for extracting structured product and review data from Pinduoduo/Yangkeduo product links.

Use it when you want to review a product from links such as:

```text
https://mobile.yangkeduo.com/goods2.html?ps=...
```

The skill bundles a read-only CLI that opens the rendered page with a persistent Chrome profile, extracts product metadata, visits the comments page, and returns compact JSON or Markdown. This avoids repeatedly spending agent/browser interaction on the same marketplace workflow.

## Install As A Codex Skill

Clone or copy this repository into your Codex skills directory:

```powershell
git clone https://github.com/michaelyosta/pdd-product-extractor-skill.git "$env:USERPROFILE\.codex\skills\pdd-product-extractor"
cd "$env:USERPROFILE\.codex\skills\pdd-product-extractor"
npm.cmd install
```

## First Login

Pinduoduo often hides product details behind authentication. Log in once:

```powershell
npm.cmd run pdd -- login
```

Chrome opens with a dedicated profile at:

```text
~\.codex\pdd-product-profile
```

After logging in, return to the terminal and press Enter.

## Fetch Product Data

Markdown:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --format markdown --out product.md
```

JSON:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --out product.json
```

If headless Chrome is blocked, retry visibly:

```powershell
npm.cmd run pdd -- fetch "https://mobile.yangkeduo.com/goods2.html?ps=..." --headful --format markdown
```

## Data Extracted

- product title, price, sales count, coupon, delivery text
- store name and store sales count
- product attributes such as shipping origin, material, features, finish
- product image URLs
- review count, media-review count, review tags
- first visible comments
- comments under the imperfect/negative tag when present

## Safety

The CLI is read-only. It does not buy items, add to cart, submit forms, or send messages.
