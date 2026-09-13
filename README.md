# lmstudio-web-tools

Web search and page reading for local models in LM Studio, with multiple search providers, PDF support, and YouTube transcripts.

An LM Studio plugin for iterative research with local models. Based on the original `nub235/web-search` project, with additional features and fixes.

## Features

- **DuckDuckGo search** — scrapes real search results with titles, URLs, and snippets via got-scraping for bot evasion
- **Optional SearXNG and Brave Search API** — separately enabled search providers with automatic fallback to DuckDuckGo
- **Web page reading** — fetches and cleans page content using [Readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) for clean prose, with [Jina Reader](https://jina.ai/reader/) as fallback
- **YouTube transcripts** — automatically extracts the full transcript when given a YouTube URL instead of scraping the page
- **PDF support** — always routed through Jina for extraction
- **Site-specific handling** — automatic URL rewrites for better content on specific sites:
  - Reddit links use old.reddit.com for clean thread access
  - arXiv abstract links redirect to the PDF version
  - Medium articles route through scribe.rip to bypass the paywall, with fallback to Jina on the original URL if scribe.rip is unavailable
  - AMP pages are de-AMPed to the original URL before fetching
  - Any URL containing "pdf" is routed through Jina
- **Prompt Guidance** — optionally injects research reminders into tool responses to steer the model toward more thorough, iterative research behavior
- **Result caching** — repeated searches within 5 minutes return cached results instantly without hitting the network again

## Installation

To run from source, install LM Studio and make its `lms` CLI available on PATH. With Node.js and npm installed, open a terminal in the project directory and run:

```sh
npm install
npm run dev
```

The plugin appears in LM Studio as `lmstudio-web-tools` while development mode is running.

## Configuration

| Setting | Default | Description |
|---|---|---|
| **Enable SearXNG** | Off | Search your SearXNG instance first. |
| **SearXNG URL** | Empty | Instance URL or `/search` endpoint, including any deployment subpath. HTTP(S), without embedded credentials. |
| **Enable Brave Search API** | Off | Use Brave if SearXNG is disabled, fails, or returns no usable results. |
| **Brave Search API Key** | Empty | Brave subscription token, entered in a protected input field. |
| **Search Results Per Page** | 5 | How many results to return per search (1–10, 0 = auto) |
| **Max Content** | 8000 | Maximum characters returned by Visit Website. Increase for long articles, decrease to save context. -1 = auto |
| **Prompt Guidance** | On | When enabled, tool responses include dynamic reminders that track how many searches and page visits have been done and nudge the model to keep researching before answering. Recommended for smaller models. Large capable models may perform better with it off. |

## Tools

**Web Search** — tries enabled providers in order: SearXNG → Brave → DuckDuckGo. The first non-empty usable result set is returned; results are not merged. With both optional providers disabled, DuckDuckGo remains the default. Each API attempt has a 10-second timeout; failure or empty results trigger the next provider. Repeated queries use the cache, which is cleared when provider settings or result count change.

Enter the SearXNG URL and/or Brave key in the plugin settings, then enable the corresponding switch. Populating a field alone does not activate a provider. SearXNG must allow `json` under `search.formats` in its server-side `settings.yml`; otherwise it returns HTTP 403. See the [SearXNG API documentation](https://docs.searxng.org/dev/search_api.html) and [Brave API documentation](https://api-dashboard.search.brave.com/api-reference/web/search/get). Use the final endpoint URL: API requests reject redirects. The protected key input does not imply encrypted storage; do not share settings containing credentials.

**Visit Website** — fetches a URL and returns cleaned text content. Handles YouTube, PDFs, Reddit, arXiv, Medium, and AMP URLs automatically. Tries Readability + Turndown first for clean, fast results. Falls back to Jina if direct fetch fails or returns poor content. PDFs always use Jina.

## Prompt Guidance

When enabled, every search and page visit returns a `reminder` field alongside the content. This reminder tracks the current research session in real time — how many searches have been done, how many pages visited — and tells the model what to do next. The intended flow is: search → visit one result → visit another → search again → visit one more → visit one more → answer.

This is most useful with smaller models that tend to answer after a single search. Larger models that already do agentic research naturally may work better with it off.

## Notes

- Failed website visits include recovery guidance: search the same topic on up to two alternative domains, verify timestamps for current data, and report unverified values instead of guessing. This guidance is included even when Prompt Guidance is off. It recommends the next tool call; the plugin does not perform an automatic alternative search or guarantee model compliance.

- Website failures report the failed reading method and available DNS, connection, TLS, timeout, or HTTP details. A Jina failure does not prevent the original Medium URL fallback. Cancellation stops further fallback requests.

- Search results and content fetching depend on DuckDuckGo and Jina being accessible from your machine — both are free services with no API key required
- YouTube transcripts require captions to exist on the video. Auto-generated captions count, but some music videos and very new uploads may not have them
- Direct fetch uses Readability (same engine as Firefox's reader mode) which strips navigation, sidebars, and other non-content elements. Link URLs are removed, keeping only the text.
- Jina is used as fallback when direct fetch fails, and always for PDFs
- Search results are cached per session in memory only — cache does not persist across LM Studio restarts

## Development checks

Install the locked dependencies and run the same checks as CI:

```sh
npm ci
npm run check
```

GitHub Actions runs these checks on pushes, pull requests, and manual dispatches, on Linux and Windows with Node.js 22.21.1 (the runtime listed in the [LM Studio plugin documentation](https://lmstudio.ai/docs/typescript/plugins)):

- `npm run validate:plugin` checks basic manifest fields, package/lockfile naming and version consistency, and required project files.
- `npm run typecheck` checks TypeScript against the installed SDK types.
- `npm test` builds the plugin and test bundles with esbuild, then runs the existing Node.js tests with mocked API responses. No credentials or live search services are required.

These are project-level checks, not official LM Studio certification. CI does not launch LM Studio, run a model, verify Hub account permissions, or publish the plugin. Before publishing, use `npm run dev` and exercise both tools in LM Studio. The [official `lms dev` command](https://lmstudio.ai/docs/cli/develop-and-publish/dev) also validates the manifest when starting the plugin.

## Credits

Based on `nub235/web-search` by nub235, distributed under the MIT License.

Originally based on [danielsig](https://lmstudio.ai/danielsig)'s DuckDuckGo search and Visit Website plugins for LM Studio.

## License

MIT
