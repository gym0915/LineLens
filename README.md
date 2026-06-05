# LineLens

## Phase4 X Article Verification

Run Phase4 gates from this directory:

```bash
npm run verify:phase4
```

The gate runs:

- `verify:phase4-pipeline-baseline`: validates clean tree, style whitelist, platform fixes, block conversion, fallback behavior, and second-platform adapter wiring.
- `verify:phase4-x-article-full`: validates the full X Article fixture at `../assets/x-article-full-html.html` when running in the normal checkout, or the outer workspace `assets/x-article-full-html.html` when running from a project worktree.

High-risk blocks (`video`, `simple-tweet`, `code`, `image-gallery`) remain dual-track and must continue to use their dedicated X Article regression gates.
