# Phase4 assets2 Legacy vs Clean Tree Report

Generated from `assets2/` on 2026-06-03. Samples: 8.

## Aggregate

| Metric | Value |
| --- | ---: |
| Samples | 8 |
| Samples with issues | 8 |
| Samples with fallback blocks | 7 |
| Samples missing selectors | 0 |
| Total legacyBlocks | 505 |
| Total cleanTreeBlocks | 569 |

## Overview

| Sample | Title | Legacy | CleanTree | Replaced | Fallback | HighRisk | Issues |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 别再手把手教AI做科研了-Scientific Agent Skills-把AI agent变成科研助手.html | 别再手把手教AI做科研了-Scientific Agent Skills-把AI agent变成科研助手 | 52 | 60 | 40 | 2 | 10 | fallback-blocks:2, low-risk-count-diff |
| 火山引擎即将上线 API！Seedance 2.0 除了打斗还可以做什么？.html | 火山引擎即将上线 API！Seedance 2.0 除了打斗还可以做什么？ | 65 | 68 | 59 | 5 | 0 | fallback-blocks:5, low-risk-count-diff |
| 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html | 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？ | 27 | 42 | 22 | 3 | 2 | fallback-blocks:3, low-risk-count-diff |
| 我们还要被“AI智障客服”折磨多久？.html | 我们还要被“AI智障客服”折磨多久？ | 114 | 116 | 113 | 0 | 1 | low-risk-count-diff |
| how i make AI videos (a beginner’s breakdown).html | how i make AI videos (a beginner’s breakdown) | 43 | 63 | 39 | 1 | 3 | fallback-blocks:1, low-risk-count-diff |
| How to make stunning HTML slides (for complete beginners).html | How to make stunning HTML slides (for complete beginners) | 17 | 23 | 9 | 6 | 0 | fallback-blocks:6, low-risk-count-diff |
| How to Set Up Obsidian From Scratch So It Works for Your Brain and Not Against It.html | How to Set Up Obsidian From Scratch So It Works for Your Brain and Not Against It | 99 | 99 | 94 | 5 | 0 | fallback-blocks:5, low-risk-count-diff |
| The web wasn't built for browser agents, here's how we built a harness to make it work. .html | The web wasn't built for browser agents, here's how we built a harness to make it work. | 88 | 98 | 70 | 14 | 4 | fallback-blocks:14, low-risk-count-diff |

## Type Counts

| Sample | paragraph | heading | quote | list | image | video | simple-tweet | code | link | image-gallery | gif | embed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 别再手把手教AI做科研了-Scientific Agent Skills-把AI agent变成科研助手.html | 31 | 9 | 0 | 2 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| 火山引擎即将上线 API！Seedance 2.0 除了打斗还可以做什么？.html | 48 | 5 | 0 | 4 | 7 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html | 18 | 1 | 1 | 3 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 我们还要被“AI智障客服”折磨多久？.html | 108 | 0 | 0 | 0 | 5 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| how i make AI videos (a beginner’s breakdown).html | 27 | 6 | 2 | 1 | 4 | 0 | 1 | 0 | 0 | 2 | 0 | 0 |
| How to make stunning HTML slides (for complete beginners).html | 7 | 0 | 0 | 5 | 3 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| How to Set Up Obsidian From Scratch So It Works for Your Brain and Not Against It.html | 83 | 11 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| The web wasn't built for browser agents, here's how we built a harness to make it work. .html | 58 | 6 | 0 | 14 | 6 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |

## Findings

### 别再手把手教AI做科研了-Scientific Agent Skills-把AI agent变成科研助手.html

- Title: 别再手把手教AI做科研了-Scientific Agent Skills-把AI agent变成科研助手
- Selector inventory: readView=1, title=1, longform=1, block=61, tweet=0, code=10, photo=1
- Low-risk count diff: paragraph 31->41, list 2->10
- Annotation stats: legacy link=1, bold=57, emoji=0; cleanTree link=2, bold=57, emoji=0
- Merge stats: replaced=40, fallback=2, highRisk=10
- Clean tree snapshot: paragraphs=61, quotes=0, listItems=10, images=0, links=1, classAttrs=0
- Issues: fallback-blocks:2, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 31->41, list 2->10.

### 火山引擎即将上线 API！Seedance 2.0 除了打斗还可以做什么？.html

- Title: 火山引擎即将上线 API！Seedance 2.0 除了打斗还可以做什么？
- Selector inventory: readView=1, title=1, longform=3, block=73, tweet=1, code=0, photo=16
- Low-risk count diff: paragraph 48->52
- Annotation stats: legacy link=0, bold=5, emoji=0; cleanTree link=0, bold=5, emoji=0
- Merge stats: replaced=59, fallback=5, highRisk=0
- Clean tree snapshot: paragraphs=72, quotes=0, listItems=4, images=22, links=6, classAttrs=0
- Issues: fallback-blocks:5, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 48->52.

### 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html

- Title: 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？
- Selector inventory: readView=1, title=1, longform=1, block=37, tweet=2, code=0, photo=8
- Low-risk count diff: paragraph 18->20, image 2->9, list 3->11
- Annotation stats: legacy link=0, bold=15, emoji=0; cleanTree link=4, bold=15, emoji=0
- Merge stats: replaced=22, fallback=3, highRisk=2
- Clean tree snapshot: paragraphs=37, quotes=5, listItems=11, images=16, links=13, classAttrs=0
- Issues: fallback-blocks:3, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 18->20, image 2->9, list 3->11.

### 我们还要被“AI智障客服”折磨多久？.html

- Title: 我们还要被“AI智障客服”折磨多久？
- Selector inventory: readView=1, title=1, longform=1, block=116, tweet=1, code=0, photo=7
- Low-risk count diff: paragraph 108->109, image 5->7
- Annotation stats: legacy link=3, bold=10, emoji=0; cleanTree link=8, bold=10, emoji=0
- Merge stats: replaced=113, fallback=0, highRisk=1
- Clean tree snapshot: paragraphs=116, quotes=2, listItems=0, images=13, links=11, classAttrs=0
- Issues: low-risk-count-diff
- Note: Low-risk block counts differ: paragraph 108->109, image 5->7.

### how i make AI videos (a beginner’s breakdown).html

- Title: how i make AI videos (a beginner’s breakdown)
- Selector inventory: readView=1, title=1, longform=4, block=57, tweet=1, code=0, photo=13
- Low-risk count diff: paragraph 27->39, image 4->16, list 1->0
- Annotation stats: legacy link=0, bold=2, emoji=0; cleanTree link=2, bold=2, emoji=0
- Merge stats: replaced=39, fallback=1, highRisk=3
- Clean tree snapshot: paragraphs=57, quotes=4, listItems=0, images=28, links=16, classAttrs=0
- Issues: fallback-blocks:1, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 27->39, image 4->16, list 1->0.

### How to make stunning HTML slides (for complete beginners).html

- Title: How to make stunning HTML slides (for complete beginners)
- Selector inventory: readView=1, title=1, longform=1, block=23, tweet=0, code=0, photo=6
- Low-risk count diff: paragraph 7->14, list 5->6
- Annotation stats: legacy link=3, bold=2, emoji=0; cleanTree link=6, bold=2, emoji=0
- Merge stats: replaced=9, fallback=6, highRisk=0
- Clean tree snapshot: paragraphs=23, quotes=0, listItems=6, images=8, links=5, classAttrs=0
- Issues: fallback-blocks:6, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 7->14, list 5->6.

### How to Set Up Obsidian From Scratch So It Works for Your Brain and Not Against It.html

- Title: How to Set Up Obsidian From Scratch So It Works for Your Brain and Not Against It
- Selector inventory: readView=1, title=1, longform=1, block=99, tweet=0, code=0, photo=1
- Low-risk count diff: paragraph 83->88, list 5->0
- Annotation stats: legacy link=4, bold=35, emoji=8; cleanTree link=8, bold=35, emoji=16
- Merge stats: replaced=94, fallback=5, highRisk=0
- Clean tree snapshot: paragraphs=99, quotes=0, listItems=0, images=0, links=4, classAttrs=0
- Issues: fallback-blocks:5, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 83->88, list 5->0.

### The web wasn't built for browser agents, here's how we built a harness to make it work. .html

- Title: The web wasn't built for browser agents, here's how we built a harness to make it work.
- Selector inventory: readView=1, title=1, longform=1, block=98, tweet=0, code=4, photo=7
- Low-risk count diff: paragraph 58->72
- Annotation stats: legacy link=18, bold=18, emoji=0; cleanTree link=36, bold=18, emoji=0
- Merge stats: replaced=70, fallback=14, highRisk=4
- Clean tree snapshot: paragraphs=98, quotes=0, listItems=14, images=12, links=24, classAttrs=0
- Issues: fallback-blocks:14, low-risk-count-diff
- Note: There are low-risk blocks where cleanTree output could not replace legacy output.
- Note: Low-risk block counts differ: paragraph 58->72.

