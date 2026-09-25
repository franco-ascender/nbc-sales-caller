# GitHub setup audit — 2026-09-17

## State

- Git has been initialized locally on branch `main`; no remote, staged files, or commits exist.
- GitHub CLI is authenticated as `fcappanera` with `repo`, `workflow`, `read:org`, and `gist` scopes.
- That account reports no accessible GitHub organizations and no accessible repositories matching `nbc` or `caller`.
- No GitHub owner can therefore be evidenced for the intended private repository. Do not create it under the personal account by inference.

## Safe repository contents

`.gitignore` excludes environment files while retaining `.env.example`, plus dependencies, builds, TypeScript build metadata, Playwright output, deployment metadata (`.vercel/`), artifacts, logs, local editor/agent state, coverage, and local/credential-like config filenames.

The private scan found two environment files: `.env.example` and `.env.local`. The latter has 13 secret-pattern matches and 26 non-empty settings; it remains ignored. The former has 15 pattern matches, but its two non-empty values are placeholder-like; it can be tracked. No other credential-named files were found.

A value-shaped credential scan initially flagged one candidate each in `tests/lead-engine-batchdata.test.ts` and `tests/lead-engine-discovery.test.ts`. Private inspection established that each appears only as an expected `Authorization` assertion in a unit test, neither matches `.env.local`, and neither test reads runtime environment configuration. These are synthetic fixture false positives and remain eligible for the allowlist. Their values were not printed.

No value-shaped candidate was found in the environment files or `config/nbc-test-agent.json`.

Review `config/nbc-test-agent.json` without printing its values; only track it if it contains no credentials or identifiable production data.

Initial allowlist: `src/`, `public/`, `supabase/migrations/`, reviewed `scripts/`, reviewed `tests/`, `docs/`, `.github/`, `config/` after the stated review, project manifests/configuration (`package*.json`, `tsconfig.json`, `next.config.ts`, `playwright.config.ts`, `next-env.d.ts`), `.gitignore`, `.vercelignore`, `README.md`, `CHANGELOG.md`, and `.env.example`. Shared project policy/configuration files remain eligible, including `.codex/config.toml` and `.claude/settings.json`; local state stays ignored. Review other tool-instruction files and handoff notes separately before adding them.

## Minimal next action

Obtain the intended GitHub organization or account from the owner, then create or select a private repository there. Add the reviewed allowlist, make an initial commit, add the HTTPS remote, and push the default branch. Verify the remote URL and branch protection afterwards.
