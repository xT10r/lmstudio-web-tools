import { createConfigSchematics } from "@lmstudio/sdk";

export const configSchematics = createConfigSchematics()
	.field("debugEnabled", "boolean", {
		displayName: "Debug Logging",
		subtitle: "Write timestamped operations, queries, URLs and errors to local JSONL files.",
	}, false)
	.field("debugDirectory", "string", {
		displayName: "Debug Log Directory",
		subtitle: "Absolute directory path. Empty uses lmstudio-web-tools inside the system temporary directory.",
	}, "")
	.field("debugIncludeResults", "boolean", {
		displayName: "Debug: Include Results",
		subtitle: "Also log returned page content and search results. May contain private information.",
	}, false)
	.field("searxngEnabled", "boolean", {
		displayName: "Enable SearXNG",
		subtitle: "Search SearXNG first; fall back to Brave (if enabled), then DuckDuckGo.",
	}, false)
	.field("searxngUrl", "string", {
		displayName: "SearXNG URL",
		subtitle: "Instance URL or /search endpoint. JSON output must be enabled on the server.",
		placeholder: "https://search.example.org",
	}, "")
	.field("braveEnabled", "boolean", {
		displayName: "Enable Brave Search API",
		subtitle: "Use Brave when SearXNG is disabled, fails, or returns no results. Requires an API key.",
	}, false)
	.field("braveApiKey", "string", {
		displayName: "Brave Search API Key",
		isProtected: true,
		isToken: true,
		subtitle: "Subscription token for Brave Search API.",
	}, "")
	.field(
		"pageSize",
		"numeric",
		{
			displayName: "Search Results Per Page",
			subtitle: "Between 1 and 10, 0 = auto",
			min: 0,
			max: 10,
			int: true,
			slider: {
				step: 1,
				min: 0,
				max: 10,
			},
		},
		5
	)
	.field(
		"contentLimit",
		"numeric",
		{
			displayName: "Max Content",
			min: -1,
			max: 50_000,
			int: true,
			subtitle: "Maximum text content size in chars returned by the Visit Website tool ",
		},
		8000
	)
	.field(
		"promptGuidance",
		"boolean",
		{
			displayName: "Prompt Guidance",
			subtitle: "Adds reminders to tool output to guide the model toward more thorough search. Recommended for small models, large models may work better without it.",
		},
		true
	)
	.build();
