# Repository instructions

## Commit messages

- Every new commit must use Conventional Commits with a non-empty scope:
  `type(scope): description` or `type(scope)!: description` for a breaking change.
- Use a lowercase type and a concise lowercase scope identifying the affected
  area. Examples: `search`, `reader`, `config`, `docs`, `ci`, `deps`, `deps-dev`,
  `repo`. Choose another meaningful scope when needed.
- Write the description in English, using an imperative verb.
- Apply this rule to ordinary, merge, revert, and squash commit messages.
  Replace generated messages when they do not include a scope.
- Before committing or selecting a PR's merge/squash title, verify that its
  message follows this format. Do not rewrite existing history solely to apply
  this rule.

Examples:

- `feat(search): add a search provider`
- `fix(reader): preserve fallback diagnostics`
- `docs(readme): clarify installation steps`
- `ci(deps): configure dependency updates`
- `chore(repo): merge remote main`
- `revert(search): revert provider changes`

Messages such as `fix: handle timeouts` or `docs: update README` are invalid
because they omit the scope.
