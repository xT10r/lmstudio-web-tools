# lmstudio-web-tools

Web search and page reading for local models in LM Studio, with multiple search providers, PDF support, and YouTube transcripts.

Provides two tools: **Web Search** finds sources, and **Visit Website** extracts readable content for follow-up research. Based on the original `nub235/web-search` project, with additional features and fixes.

The model chooses when to call each tool; the plugin executes those calls and returns results. Research depends on the model's tool use. The model runs locally, while searches and page reading make network requests to search providers, websites, and, when needed, Jina Reader.

## Features

- **DuckDuckGo search** — returns titles, URLs, and snippets without an API key
- **Optional SearXNG and Brave Search API** — separately enabled search providers with automatic fallback to DuckDuckGo
- **Web page reading** — fetches and cleans page content using [Readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) for clean prose, with [Jina Reader](https://jina.ai/reader/) as fallback
- **YouTube transcripts** — reads available captions from `youtube.com/watch?v=...` and `youtu.be/...` links, limited by Max Content
- **PDF support** — always routed through Jina for extraction
- **Site-specific handling** — automatic URL rewrites for better content on specific sites:
  - Reddit links use old.reddit.com for clean thread access
  - arXiv abstract links redirect to the PDF version
  - Medium articles are tried through scribe.rip, then through Jina on the original URL if reading fails; access to the full article is not guaranteed
  - AMP pages are de-AMPed to the original URL before fetching
- **Prompt Guidance** — optionally injects research reminders into tool responses to steer the model toward more thorough, iterative research behavior
- **Result caching** — reuses successful search results for up to 5 minutes while settings remain unchanged

## Installation

To run from source, install LM Studio, Git, Node.js, and npm, and make the `lms` CLI available on PATH. CI checks this project with Node.js 22.21.1.

Clone the repository and start the plugin:

```sh
git clone https://github.com/xT10r/lmstudio-web-tools.git
cd lmstudio-web-tools
npm ci
npm run dev
```

The plugin appears in LM Studio as `lmstudio-web-tools` while development mode is running. Enable it in a chat and use a model that supports tool calling.

DuckDuckGo is enabled by default. To use SearXNG or Brave, configure and enable the provider in the plugin settings below.

Example prompt:

> Find the official documentation for SearXNG's search API, read it, and summarize how to request JSON results. Include the source URL.

## Configuration

| Setting | Default | Description |
|---|---|---|
| **Enable SearXNG** | Off | Search your SearXNG instance first. |
| **SearXNG URL** | Empty | Instance URL or `/search` endpoint, including any deployment subpath. HTTP(S), without embedded credentials. |
| **Enable Brave Search API** | Off | Use Brave if SearXNG is disabled, fails, or returns no usable results. |
| **Brave Search API Key** | Empty | Brave subscription token, entered in a protected input field. |
| **Search Results Per Page** | 5 | Maximum results per search (1–10). `0` uses a fixed default of 5. |
| **Max Content** | 8000 | Maximum characters in returned content, including transcripts and PDFs. `-1` uses a fixed default of 8000. Low limits can cause page-reading failures; see Notes. |
| **Prompt Guidance** | On | Adds optional reminders based on search and visit counts. Try it with your model; improved answer quality is not guaranteed. |

## Tools

**Web Search** — tries enabled providers in order: SearXNG → Brave → DuckDuckGo. The first non-empty usable result set is returned; results are not merged. With both optional providers disabled, DuckDuckGo remains the default. Each API attempt has a 10-second timeout; failure or empty results trigger the next provider. Repeated queries use the cache, which is cleared when provider settings or result count change.

Enter the SearXNG URL and/or Brave key in the plugin settings, then enable the corresponding switch. Populating a field alone does not activate a provider. SearXNG must allow `json` under `search.formats` in its server-side `settings.yml`; otherwise it returns HTTP 403. See the [SearXNG API documentation](https://docs.searxng.org/dev/search_api.html) and [Brave API documentation](https://api-dashboard.search.brave.com/api-reference/web/search/get). Use the final endpoint URL: API requests reject redirects. The protected key input does not imply encrypted storage; do not share settings containing credentials.

**Visit Website** — fetches a URL and returns a title and text limited by Max Content. Ordinary pages use Readability + Turndown first, with Jina as fallback. Supported YouTube links first attempt caption extraction. PDF handling uses a URL heuristic: a URL containing `pdf` (case-insensitive) is routed to Jina rather than checked by content type.

## Prompt Guidance

When enabled, successful searches and page visits can include a `reminder` field alongside the content. Reminders use the current search and visit counts to suggest the next step. Cached search results do not include a reminder. The intended flow is: search → visit one result → visit another → search again → visit one more → visit one more → answer.

These are suggestions to the model, not an enforced workflow. Try enabling or disabling them for your model and task. The automated tests do not measure their effect on answer quality.

## Notes

- Failed website visits include recovery guidance: search the same topic on up to two alternative domains, verify timestamps for current data, and report unverified values instead of guessing. This guidance is included even when Prompt Guidance is off. It recommends the next tool call; the plugin does not perform an automatic alternative search or guarantee model compliance.

- Website failures report the failed reading method and available DNS, connection, TLS, timeout, or HTTP details. A Jina failure does not prevent the original Medium URL fallback. Cancellation stops further fallback requests.

- The main direct and Jina reading paths reject content shorter than 2000 characters after truncation. Short pages or Max Content below 2000 can therefore cause failures even when a page is accessible. A limit of 2000 can also fall below this threshold when truncation ends at a paragraph or sentence boundary. The original Medium URL fallback uses a 500-character threshold; PDFs and transcripts do not use these thresholds.
- YouTube extraction requires accessible captions. A supported URL does not guarantee that a transcript can be retrieved.
- Direct fetch uses Readability (same engine as Firefox's reader mode) which strips navigation, sidebars, and other non-content elements. Link URLs are removed, keeping only the text.
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

## Dependency updates

[Dependabot](.github/dependabot.yml) checks npm dependencies and GitHub Actions every Monday at 10:00 Europe/Moscow and opens pull requests for available updates. The [CI workflow](.github/workflows/ci.yml) checks each update on Linux and Windows. Updates require review and merging; they are not merged automatically. Test SDK and other runtime dependency updates in LM Studio before merging.

Minor and patch updates are grouped separately for runtime dependencies, development dependencies, and GitHub Actions. Major updates remain separate PRs. CI rejects dependencies whose declared Node.js requirements do not support the tested runtime. PR titles must use `type(scope): description`; squash merges use that title as the commit message.

## Credits

Based on `nub235/web-search` by nub235, distributed under the MIT License.

Originally based on [danielsig](https://lmstudio.ai/danielsig)'s DuckDuckGo search and Visit Website plugins for LM Studio.

## License

Licensed under the [MIT License](LICENSE).
