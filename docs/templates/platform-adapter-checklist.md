# Platform Adapter Checklist

Use this checklist before adding a new media/news platform adapter.

## Order

1. Copy the verifier template:

   ```bash
   cp scripts/templates/verify-platform-article-template.mjs scripts/verify-<platform>-article-fixture.mjs
   ```

2. Fill adapter id, fixture URL, fixture HTML, expected title, expected block order, order anchors, and special component assertions.
3. Run the new verifier and confirm it fails before implementation.
4. Add or update `src/content/adapters/<platform>-article-adapter.ts`.
5. Add platform-owned special component handlers only when needed.
6. Verify configurable extraction and Reader rendering from Article JSON.
7. Update `public/manifest.json` scope only after adapter and fixture verifier pass.

## Minimum Validation

```bash
npm run build
npm run verify:platform-template-fixture
npm run verify:adapter-manifest-scope
npm run verify:configurable-article-extractor
```

## Standard Entry Files

- `src/content/adapters/<platform>-article-adapter.ts`
- `src/content/extractors/<platform>/*handler.ts` when special components are required
- `scripts/verify-<platform>-article-fixture.mjs`
- `public/manifest.json` after verifier stability

Reader files should not receive platform selectors or source DOM classes.
