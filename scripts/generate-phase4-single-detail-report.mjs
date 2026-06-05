import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { buildCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';

const requestedName = process.argv.slice(2).join(' ').trim();
if (!requestedName) {
  throw new Error('Usage: node scripts/generate-phase4-single-detail-report.mjs "<sample file name>"');
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = findWorkspaceRoot(projectRoot);
const assetsDir = resolve(workspaceRoot, 'assets2');
const inputPath = resolve(assetsDir, requestedName);
const reportDir = resolve(workspaceRoot, 'docs', 'reports');
const reportPath = resolve(reportDir, `2026-06-03-${slugify(requestedName)}-detail-report.md`);

const html = readFileSync(inputPath, 'utf8');
const dom = new JSDOM(html, {
  url: syntheticUrl(requestedName)
});

globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { document } = dom.window;
const readView = document.querySelector(X_ARTICLE_SELECTORS.readView);
const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
const title = normalizeText(readView?.querySelector(X_ARTICLE_SELECTORS.title)?.textContent ?? '');

if (!readView || !longform || !title) {
  throw new Error(`Missing core selectors for ${requestedName}`);
}

const articleId = stableId(requestedName);
const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
  longform,
  articleId
});
const mainPath = buildCleanTreePrimaryBlocks({
  sourceRoot: longform,
  adapter: xArticleAdapter,
  sourceUrl: dom.window.location.href,
  debugId: `assets2:${slugify(requestedName)}`,
  legacyBlocks
});

const detailTypes = ['paragraph', 'list', 'image', 'code', 'simple-tweet', 'image-gallery'];
const detailed = Object.fromEntries(
  detailTypes.map((type) => [
    type,
    buildDetailedDiff({
      type,
      legacyBlocks,
      cleanTreeBlocks: mainPath.cleanTreeBlocks,
      html
    })
  ])
);

const markdown = renderMarkdown({
  requestedName,
  title,
  detailTypes,
  detailed,
  summary: {
    legacyTotal: legacyBlocks.length,
    cleanTreeTotal: mainPath.cleanTreeBlocks.length,
    replaced: mainPath.replacedBlockCount,
    fallback: mainPath.fallbackBlockCount,
    highRisk: mainPath.highRiskBlockCount
  }
});

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, markdown, 'utf8');

console.log(
  JSON.stringify(
    {
      reportPath,
      sample: requestedName,
      title,
      summary: {
        legacyTotal: legacyBlocks.length,
        cleanTreeTotal: mainPath.cleanTreeBlocks.length,
        replaced: mainPath.replacedBlockCount,
        fallback: mainPath.fallbackBlockCount,
        highRisk: mainPath.highRiskBlockCount
      },
      paragraph: summarizeRows(detailed.paragraph.rows),
      list: summarizeRows(detailed.list.rows),
      image: summarizeRows(detailed.image.rows),
      code: summarizeRows(detailed.code.rows),
      simpleTweet: summarizeRows(detailed['simple-tweet'].rows),
      imageGallery: summarizeRows(detailed['image-gallery'].rows)
    },
    null,
    2
  )
);

function buildDetailedDiff({ type, legacyBlocks, cleanTreeBlocks, html }) {
  const legacyItems = legacyBlocks
    .filter((block) => block.type === type)
    .map((block, index) => toComparableRecord(block, index + 1, 'legacy', html));
  const cleanItems = cleanTreeBlocks
    .filter((block) => block.type === type)
    .map((block, index) => toComparableRecord(block, index + 1, 'cleanTree', html));

  const usedClean = new Set();
  const rows = [];

  for (const legacyItem of legacyItems) {
    const matchIndex = findBestMatch(legacyItem, cleanItems, usedClean);
    if (matchIndex === -1) {
      rows.push({
        status: 'legacy-only',
        legacyIndex: legacyItem.index,
        cleanTreeIndex: '',
        legacyLine: legacyItem.line,
        cleanTreeLine: '',
        preview: legacyItem.preview,
        legacyLength: legacyItem.length,
        cleanTreeLength: '',
        note: 'No cleanTree match'
      });
      continue;
    }

    usedClean.add(matchIndex);
    const cleanItem = cleanItems[matchIndex];
    const identical = legacyItem.matchKey === cleanItem.matchKey;
    rows.push({
      status: identical ? 'matched' : 'changed',
      legacyIndex: legacyItem.index,
      cleanTreeIndex: cleanItem.index,
      legacyLine: legacyItem.line,
      cleanTreeLine: cleanItem.line,
      preview: identical ? legacyItem.preview : `${legacyItem.preview} => ${cleanItem.preview}`,
      legacyLength: legacyItem.length,
      cleanTreeLength: cleanItem.length,
      note: identical ? 'Exact normalized match' : `Similarity ${scoreSimilarity(legacyItem, cleanItem).toFixed(2)}`
    });
  }

  cleanItems.forEach((cleanItem, index) => {
    if (usedClean.has(index)) {
      return;
    }

    rows.push({
      status: 'clean-only',
      legacyIndex: '',
      cleanTreeIndex: cleanItem.index,
      legacyLine: '',
      cleanTreeLine: cleanItem.line,
      preview: cleanItem.preview,
      legacyLength: '',
      cleanTreeLength: cleanItem.length,
      note: 'Extra cleanTree block'
    });
  });

  return {
    legacyCount: legacyItems.length,
    cleanTreeCount: cleanItems.length,
    rows
  };
}

function toComparableRecord(block, index, side, html) {
  if (block.type === 'paragraph') {
    const text = normalizeText(block.text);
    return {
      side,
      type: block.type,
      index,
      matchKey: text,
      preview: preview(text),
      length: text.length,
      line: locateLine(html, text, block.type)
    };
  }

  if (block.type === 'list') {
    const joined = normalizeText(block.items.join(' / '));
    return {
      side,
      type: block.type,
      index,
      matchKey: `${block.kind ?? 'unordered'}::${joined}`,
      preview: `${block.kind ?? 'unordered'}: ${preview(joined)}`,
      length: joined.length,
      line: locateLine(html, block.items[0] ?? joined, block.type)
    };
  }

  if (block.type === 'image') {
    return {
      side,
      type: block.type,
      index,
      matchKey: block.src,
      preview: preview(block.src),
      length: block.src.length,
      line: locateLine(html, block.src, block.type)
    };
  }

  if (block.type === 'code') {
    const text = normalizeCodeText(block.text);
    return {
      side,
      type: block.type,
      index,
      matchKey: `${normalizeCodeLanguageForComparison(block.language)}::${text}`,
      preview: `${block.language ?? 'plain'}: ${preview(text)}`,
      length: text.length,
      line: locateLine(html, text.split('\n')[0] ?? text, block.type)
    };
  }

  if (block.type === 'simple-tweet') {
    const text = normalizeText([block.title, block.excerpt, block.href ?? '', String(block.photos?.length ?? 0)].join(' '));
    return {
      side,
      type: block.type,
      index,
      matchKey: text,
      preview: preview(`${block.title} / ${block.excerpt}`),
      length: text.length,
      line: locateLine(html, block.excerpt || block.title, block.type)
    };
  }

  if (block.type === 'image-gallery') {
    const text = block.items.map((item) => item.src).join(' | ');
    return {
      side,
      type: block.type,
      index,
      matchKey: text,
      preview: `${block.items.length} items: ${preview(text)}`,
      length: block.items.length,
      line: locateLine(html, block.items[0]?.src ?? '', 'image')
    };
  }

  throw new Error(`Unsupported block type: ${block.type}`);
}

function findBestMatch(legacyItem, cleanItems, usedClean) {
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < cleanItems.length; index += 1) {
    if (usedClean.has(index)) {
      continue;
    }
    const cleanItem = cleanItems[index];
    if (legacyItem.type !== cleanItem.type) {
      continue;
    }

    const score = scoreSimilarity(legacyItem, cleanItem);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 0.82 ? bestIndex : -1;
}

function scoreSimilarity(left, right) {
  if (left.matchKey === right.matchKey) {
    return 1;
  }

  const leftTokens = tokenSet(left.matchKey);
  const rightTokens = tokenSet(right.matchKey);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

function tokenSet(value) {
  return new Set(
    normalizeText(value)
      .split(/[\s/,:;|()[\]{}"'`]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function locateLine(html, needle, type) {
  const rawNeedle = decodeHtml(needle).trim();
  if (!rawNeedle) {
    return '';
  }

  const candidates = [
    rawNeedle,
    rawNeedle.slice(0, 120),
    rawNeedle.slice(0, 80),
    type === 'image' ? rawNeedle.replace(/&/g, '&amp;') : ''
  ].filter(Boolean);

  for (const candidate of candidates) {
    const index = html.indexOf(candidate);
    if (index !== -1) {
      return 1 + html.slice(0, index).split('\n').length - 1;
    }
  }

  return '';
}

function renderMarkdown({ requestedName, title, detailTypes, detailed, summary }) {
  const lines = [
    `# Detail Report: ${requestedName}`,
    '',
    `Title: ${title}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| legacyBlocks | ${summary.legacyTotal} |`,
    `| cleanTreeBlocks | ${summary.cleanTreeTotal} |`,
    `| replaced | ${summary.replaced} |`,
    `| fallback | ${summary.fallback} |`,
    `| highRisk | ${summary.highRisk} |`,
    ''
  ];

  for (const type of detailTypes) {
    const section = detailed[type];
    lines.push(`## ${capitalize(type)}`);
    lines.push('');
    lines.push(`legacy: ${section.legacyCount}, cleanTree: ${section.cleanTreeCount}`);
    lines.push('');
    lines.push('| Status | Legacy # | CleanTree # | Legacy Line | CleanTree Line | Preview | Legacy Len | CleanTree Len | Note |');
    lines.push('| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |');
    for (const row of section.rows) {
      lines.push(
        `| ${row.status} | ${row.legacyIndex || ''} | ${row.cleanTreeIndex || ''} | ${row.legacyLine || ''} | ${row.cleanTreeLine || ''} | ${escapeTable(row.preview)} | ${row.legacyLength || ''} | ${row.cleanTreeLength || ''} | ${escapeTable(row.note)} |`
      );
    }
    lines.push('');
  }

  lines.push('## Reading Notes', '');
  lines.push('- `matched` means the normalized content is effectively the same.');
  lines.push('- `changed` means the two sides were similar enough to pair, but the extracted content was not identical.');
  lines.push('- `legacy-only` means the old pipeline had a block that cleanTree did not produce.');
  lines.push('- `clean-only` means cleanTree produced an extra block. Those rows are the fastest place to inspect over-extraction.');
  lines.push('- HTML line numbers are approximate source locations based on the first matching text or src snippet in the original HTML.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function summarizeRows(rows) {
  return rows.reduce(
    (summary, row) => {
      summary[row.status] = (summary[row.status] ?? 0) + 1;
      return summary;
    },
    {}
  );
}

function preview(value) {
  const normalized = normalizeText(value);
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stableId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function syntheticUrl(fileName) {
  return `https://x.com/i/article/${stableId(fileName)}#${encodeURIComponent(fileName)}`;
}

function normalizeText(text) {
  return decodeHtml(text)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?，。！？；：])/g, '$1')
    .trim();
}

function normalizeCodeText(text) {
  return decodeHtml(text).replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
}

function normalizeCodeLanguageForComparison(language) {
  const normalized = normalizeText(language ?? '').toLowerCase();
  return normalized === 'text' || normalized === 'plain' ? '' : normalized;
}

function slugify(value) {
  return basename(value, extname(value))
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escapeTable(value) {
  return String(value).replace(/\|/g, '\\|');
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  let bestMatch = null;
  for (let depth = 0; depth < 8; depth += 1) {
    if (readdirSafe(resolve(current)).includes('assets2')) {
      bestMatch = current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  if (bestMatch) {
    return bestMatch;
  }

  throw new Error(`Unable to locate workspace root with assets2 from ${startDir}`);
}

function readdirSafe(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}
