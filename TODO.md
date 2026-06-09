# TODO - Webpage/Sitemap Mode Update

## Plan checkpoints
- [ ] Replace broken/partial `src/lib/validation/engine.ts` with a compiling version that supports both `sitemap` and `webpage` runMode.
- [ ] In sitemap mode: preserve existing behavior (crawl both sitemaps, align by relative path, validate pages).
- [ ] In webpage mode: implement root crawling/discovery, align by relative path with domain-different requirement, fail-fast on path mismatch, then validate selected pages.
- [ ] Ensure API/start accepts new params shape and reports errors correctly.
- [ ] Re-run `npm run build` to verify compilation.

