import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { buildCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';
import {
  buildCleanTreeDebugSnapshot,
  cloneContentTree,
  createCleanTreeContext
} from '../dist/content/preprocess/clone-content-tree.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = findWorkspaceRoot(projectRoot);
const assetsDir = resolve(workspaceRoot, 'assets2');
const reportDir = resolve(workspaceRoot, 'docs', 'reports');
const reportPath = resolve(reportDir, '2026-06-03-phase4-assets2-legacy-vs-clean-tree-report.md');

const sampleFiles = readdirSync(assetsDir)
  .filter((fileName) => extname(fileName).toLowerCase() === '.html')
  .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));

const sampleReports = [];

for (const fileName of sampleFiles) {
  const html = readFileSync(resolve(assetsDir, fileName), 'utf8');
  const dom = new JSDOM(html, {
    url: syntheticUrl(fileName)
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
  const debugId = `assets2:${slugify(fileName)}`;
  const report = {
    fileName,
    title,
    rootFound: readView !== null,
    longformFound: longform !== null,
    selectorInventory: {
      readView: document.querySelectorAll(X_ARTICLE_SELECTORS.readView).length,
      title: document.querySelectorAll(X_ARTICLE_SELECTORS.title).length,
      longform: document.querySelectorAll(X_ARTICLE_SELECTORS.longform).length,
      block: document.querySelectorAll(X_ARTICLE_SELECTORS.block).length,
      tweet: document.querySelectorAll(X_ARTICLE_SELECTORS.tweetBlock).length,
      code: document.querySelectorAll(X_ARTICLE_SELECTORS.codeBlock).length,
      photo: document.querySelectorAll(X_ARTICLE_SELECTORS.tweetPhoto).length
    },
    issues: [],
    analysisNotes: []
  };

  if (!readView || !longform || !title) {
    if (!readView) report.issues.push('missing-readView');
    if (!longform) report.issues.push('missing-longform');
    if (!title) report.issues.push('missing-title');
    sampleReports.push(report);
    continue;
  }

  const articleId = stableId(fileName);
  const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
    longform,
    articleId
  });
  const mainPath = buildCleanTreePrimaryBlocks({
    sourceRoot: longform,
    adapter: xArticleAdapter,
    sourceUrl: dom.window.location.href,
    debugId,
    legacyBlocks
  });
  const cleanTreeContext = createCleanTreeContext({
    adapter: xArticleAdapter,
    sourceUrl: dom.window.location.href,
    debugId
  });
  const cleanTree = cloneContentTree(longform, cleanTreeContext);
  const cleanTreeDebugSnapshot = buildCleanTreeDebugSnapshot(cleanTree);

  const legacySummary = summarizeBlocks(legacyBlocks);
  const cleanTreeSummary = summarizeBlocks(mainPath.cleanTreeBlocks);
  const lowRiskDiff = diffCounts(legacySummary.lowRiskCounts, cleanTreeSummary.lowRiskCounts);

  report.legacySummary = legacySummary;
  report.cleanTreeSummary = cleanTreeSummary;
  report.cleanTreeDebugSnapshot = cleanTreeDebugSnapshot;
  report.mergeStats = {
    replacedBlockCount: mainPath.replacedBlockCount,
    fallbackBlockCount: mainPath.fallbackBlockCount,
    highRiskBlockCount: mainPath.highRiskBlockCount
  };
  report.lowRiskDiff = lowRiskDiff;

  if (mainPath.fallbackBlockCount > 0) {
    report.issues.push(`fallback-blocks:${mainPath.fallbackBlockCount}`);
    report.analysisNotes.push('There are low-risk blocks where cleanTree output could not replace legacy output.');
  }

  if (Object.keys(lowRiskDiff).length > 0 && mainPath.fallbackBlockCount > 0) {
    report.issues.push('low-risk-count-diff');
    report.analysisNotes.push(`Low-risk block counts differ: ${formatDiff(lowRiskDiff)}.`);
  } else if (Object.keys(lowRiskDiff).length > 0) {
    report.analysisNotes.push(`CleanTree candidate counts differ before merge, but all legacy blocks were replaced: ${formatDiff(lowRiskDiff)}.`);
  }

  const orderedFix = cleanTreeDebugSnapshot.platformFixes.results.find((item) => item.id === 'normalize-handwritten-ordered-list');
  if ((legacySummary.lowRiskCounts.list ?? 0) > 0 && (!orderedFix || orderedFix.changedNodeCount === 0)) {
    report.issues.push('list-fix-noop');
    report.analysisNotes.push('The sample has list output, but ordered/unordered normalization did not touch any node in clean tree preprocessing.');
  }

  if ((legacySummary.countsByType['simple-tweet'] ?? 0) > 0 && cleanTreeDebugSnapshot.quoteCount === 0) {
    report.issues.push('quote-snapshot-mismatch');
    report.analysisNotes.push('The sample contains embedded tweet/simpleTweet blocks, but clean tree debug snapshot did not record quote candidates.');
  }

  if ((legacySummary.annotationStats.linkAnnotations ?? 0) === 0 && legacySummary.countsByType.link === 0) {
    report.issues.push('no-link-semantics');
    report.analysisNotes.push('No inline or standalone link semantics were extracted from the article blocks.');
  }

  sampleReports.push(report);
}

const aggregate = {
  sampleCount: sampleReports.length,
  issueCount: sampleReports.filter((sample) => sample.issues.length > 0).length,
  fallbackSamples: sampleReports.filter((sample) => (sample.mergeStats?.fallbackBlockCount ?? 0) > 0).length,
  missingSelectorSamples: sampleReports.filter((sample) => !sample.rootFound || !sample.longformFound || !sample.title).length,
  totalLegacyBlocks: sum(sampleReports.map((sample) => sample.legacySummary?.totalBlocks ?? 0)),
  totalCleanTreeBlocks: sum(sampleReports.map((sample) => sample.cleanTreeSummary?.totalBlocks ?? 0))
};

const markdown = renderMarkdownReport(sampleReports, aggregate);
mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, markdown, 'utf8');

console.log(
  JSON.stringify(
    {
      reportPath,
      aggregate,
      samples: sampleReports.map((sample) => ({
        fileName: sample.fileName,
        title: sample.title,
        issues: sample.issues,
        legacyBlocks: sample.legacySummary?.totalBlocks ?? null,
        cleanTreeBlocks: sample.cleanTreeSummary?.totalBlocks ?? null,
        fallbackBlockCount: sample.mergeStats?.fallbackBlockCount ?? null
      }))
    },
    null,
    2
  )
);

function summarizeBlocks(blocks) {
  const countsByType = {};
  const lowRiskCounts = {};
  const annotationStats = {
    boldAnnotations: 0,
    linkAnnotations: 0,
    emojiAnnotations: 0
  };
  const mediaStats = {
    imagesWithHref: 0,
    videosWithHls: 0,
    simpleTweetsWithVideo: 0
  };
  const listItemCount = { ordered: 0, unordered: 0 };
  let totalTextLength = 0;

  for (const block of blocks) {
    countsByType[block.type] = (countsByType[block.type] ?? 0) + 1;
    if (['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'simple-tweet', 'image-gallery'].includes(block.type)) {
      lowRiskCounts[block.type] = (lowRiskCounts[block.type] ?? 0) + 1;
    }

    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
        totalTextLength += block.text.length;
        countAnnotations(block.annotations ?? [], annotationStats);
        break;
      case 'list':
        totalTextLength += block.items.join('\n').length;
        listItemCount[block.kind === 'ordered' ? 'ordered' : 'unordered'] += block.items.length;
        for (const itemAnnotations of block.itemAnnotations ?? []) {
          countAnnotations(itemAnnotations, annotationStats);
        }
        break;
      case 'link':
        totalTextLength += block.text.length;
        annotationStats.linkAnnotations += 1;
        break;
      case 'image':
        if (block.href) {
          mediaStats.imagesWithHref += 1;
        }
        break;
      case 'video':
        if (block.hls?.masterPlaylistUrl || (block.hls?.videoPlaylists?.length ?? 0) > 0) {
          mediaStats.videosWithHls += 1;
        }
        break;
      case 'simple-tweet':
        totalTextLength += `${block.title} ${block.excerpt}`.trim().length;
        if (block.video) {
          mediaStats.simpleTweetsWithVideo += 1;
        }
        break;
      case 'code':
        totalTextLength += block.text.length;
        break;
      default:
        break;
    }
  }

  return {
    totalBlocks: blocks.length,
    countsByType,
    lowRiskCounts,
    totalTextLength,
    annotationStats,
    mediaStats,
    listItemCount
  };
}

function countAnnotations(annotations, annotationStats) {
  for (const annotation of annotations) {
    if (annotation.bold) {
      annotationStats.boldAnnotations += 1;
    }
    if (annotation.href) {
      annotationStats.linkAnnotations += 1;
    }
    if (annotation.emojiImageUrl) {
      annotationStats.emojiAnnotations += 1;
    }
  }
}

function diffCounts(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diff = {};
  for (const key of keys) {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    if (leftValue !== rightValue) {
      diff[key] = { legacy: leftValue, cleanTree: rightValue };
    }
  }
  return diff;
}

function formatDiff(diff) {
  return Object.entries(diff)
    .map(([key, value]) => `${key} ${value.legacy}->${value.cleanTree}`)
    .join(', ');
}

function renderMarkdownReport(sampleReports, aggregate) {
  const lines = [
    '# Phase4 assets2 Legacy vs Clean Tree Report',
    '',
    `Generated from \`assets2/\` on 2026-06-03. Samples: ${aggregate.sampleCount}.`,
    '',
    '## Aggregate',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Samples | ${aggregate.sampleCount} |`,
    `| Samples with issues | ${aggregate.issueCount} |`,
    `| Samples with fallback blocks | ${aggregate.fallbackSamples} |`,
    `| Samples missing selectors | ${aggregate.missingSelectorSamples} |`,
    `| Total legacyBlocks | ${aggregate.totalLegacyBlocks} |`,
    `| Total cleanTreeBlocks | ${aggregate.totalCleanTreeBlocks} |`,
    '',
    '## Overview',
    '',
    '| Sample | Title | Legacy | CleanTree | Replaced | Fallback | HighRisk | Issues |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
  ];

  for (const sample of sampleReports) {
    lines.push(
      `| ${escapeTable(sample.fileName)} | ${escapeTable(sample.title || '-')} | ${sample.legacySummary?.totalBlocks ?? '-'} | ${sample.cleanTreeSummary?.totalBlocks ?? '-'} | ${sample.mergeStats?.replacedBlockCount ?? '-'} | ${sample.mergeStats?.fallbackBlockCount ?? '-'} | ${sample.mergeStats?.highRiskBlockCount ?? '-'} | ${escapeTable(sample.issues.join(', ') || 'ok')} |`
    );
  }

  lines.push('', '## Type Counts', '', '| Sample | paragraph | heading | quote | list | image | video | simple-tweet | code | link | image-gallery | gif | embed |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const sample of sampleReports) {
    const counts = sample.legacySummary?.countsByType ?? {};
    lines.push(
      `| ${escapeTable(sample.fileName)} | ${counts.paragraph ?? 0} | ${counts.heading ?? 0} | ${counts.quote ?? 0} | ${counts.list ?? 0} | ${counts.image ?? 0} | ${counts.video ?? 0} | ${counts['simple-tweet'] ?? 0} | ${counts.code ?? 0} | ${counts.link ?? 0} | ${counts['image-gallery'] ?? 0} | ${counts.gif ?? 0} | ${counts.embed ?? 0} |`
    );
  }

  lines.push('', '## Findings', '');
  for (const sample of sampleReports) {
    lines.push(`### ${sample.fileName}`);
    lines.push('');
    lines.push(`- Title: ${sample.title || '-'}`);
    lines.push(`- Selector inventory: readView=${sample.selectorInventory.readView}, title=${sample.selectorInventory.title}, longform=${sample.selectorInventory.longform}, block=${sample.selectorInventory.block}, tweet=${sample.selectorInventory.tweet}, code=${sample.selectorInventory.code}, photo=${sample.selectorInventory.photo}`);
    if (sample.legacySummary && sample.cleanTreeSummary) {
      lines.push(`- Low-risk count diff: ${Object.keys(sample.lowRiskDiff).length === 0 ? 'none' : formatDiff(sample.lowRiskDiff)}`);
      lines.push(`- Annotation stats: legacy link=${sample.legacySummary.annotationStats.linkAnnotations}, bold=${sample.legacySummary.annotationStats.boldAnnotations}, emoji=${sample.legacySummary.annotationStats.emojiAnnotations}; cleanTree link=${sample.cleanTreeSummary.annotationStats.linkAnnotations}, bold=${sample.cleanTreeSummary.annotationStats.boldAnnotations}, emoji=${sample.cleanTreeSummary.annotationStats.emojiAnnotations}`);
      lines.push(`- Merge stats: replaced=${sample.mergeStats.replacedBlockCount}, fallback=${sample.mergeStats.fallbackBlockCount}, highRisk=${sample.mergeStats.highRiskBlockCount}`);
      lines.push(`- Clean tree snapshot: paragraphs=${sample.cleanTreeDebugSnapshot.paragraphCount}, quotes=${sample.cleanTreeDebugSnapshot.quoteCount}, listItems=${sample.cleanTreeDebugSnapshot.listItemCount}, images=${sample.cleanTreeDebugSnapshot.imageCount}, links=${sample.cleanTreeDebugSnapshot.linkCount}, classAttrs=${sample.cleanTreeDebugSnapshot.classAttributeCount}`);
    }
    lines.push(`- Issues: ${sample.issues.length === 0 ? 'none' : sample.issues.join(', ')}`);
    for (const note of sample.analysisNotes) {
      lines.push(`- Note: ${note}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function syntheticUrl(fileName) {
  return `https://x.com/i/article/${stableId(fileName)}#${encodeURIComponent(fileName)}`;
}

function stableId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function slugify(value) {
  return basename(value, extname(value))
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
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
