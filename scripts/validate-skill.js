#!/usr/bin/env node

import fs from 'node:fs';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const skill = fs.readFileSync('SKILL.md', 'utf8').replace(/^\uFEFF/, '');
if (!skill.startsWith('---\n')) fail('SKILL.md must start with YAML frontmatter.');

const end = skill.indexOf('\n---\n', 4);
if (end < 0) fail('SKILL.md frontmatter must be closed.');

const frontmatter = skill.slice(4, end);
if (!/^name:\s*pdd-product-extractor\s*$/m.test(frontmatter)) fail('SKILL.md must declare name: pdd-product-extractor.');
if (!/^description:\s+\S/m.test(frontmatter)) fail('SKILL.md must declare a non-empty description.');
if (/\[TODO:/.test(skill)) fail('SKILL.md still contains TODO placeholders.');

const agentYaml = fs.readFileSync('agents/openai.yaml', 'utf8');
for (const key of ['display_name', 'short_description', 'default_prompt']) {
  if (!new RegExp(`${key}:\\s+"[^"]+"`).test(agentYaml)) fail(`agents/openai.yaml missing ${key}.`);
}

console.log('Skill metadata is valid.');
