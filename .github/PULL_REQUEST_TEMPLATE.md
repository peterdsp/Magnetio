## What this changes

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## Why

<!-- The problem it solves, or the site it adds coverage for. -->

## What I verified

<!--
Paste real output. For a new provider, the isolated query is the useful proof:

  curl "localhost:8080/streams/movie/tt0068646?providers=mysite"
  curl "localhost:8080/streams/series/tt0944947:2:3?providers=mysite"

A PR that shows real results from a real query gets merged quickly.
-->

```
```

## Checklist

- [ ] `npm test` passes in every package I touched (`scraper/`, `addon/`)
- [ ] No API key, token, or real account in the diff or the description
- [ ] No em-dash in prose, code, or commit messages (house style)
- [ ] The diff is scoped to one thing, with no unrelated refactors

### For a new provider

- [ ] Registered in `scraper/providers/index.js` (import plus `ALL_PROVIDERS`)
- [ ] `infoHash` is lowercase hex
- [ ] All network calls go through `lib/httpClient.js` with `limiterKey: id`
- [ ] `scrape` cannot throw: the body is wrapped and returns `[]` on failure
- [ ] Results are returned unfiltered and unsorted (the pipeline handles that)
