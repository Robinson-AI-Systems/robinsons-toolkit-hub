# Opt-in local browser for `rtool mcp` (L-3)

The `local.browser_*` capabilities run **on your own machine**, never on
Vercel, hosted Toolkit Hub or a GitHub relay. They are optional and absent by
default. Enabling these tools does not give a provider server access to your
files or browser profile.

## Explicit local setup

First install Playwright for your local rtool installation and its matching
Chromium browser **yourself**. In the repository's local working copy, the
optional setup is:

```sh
npm install --no-save playwright
npx playwright install chromium
```

These commands are not run automatically by ChatGPT, GitHub CI, your normal
`npm ci`, or any Hub deployment. The optional module is deliberately
unbundled; a fresh dependency install may require repeating this local setup.

Set `RTOOL_BROWSER_ALLOWED_ORIGINS` to 1–8 exact comma-separated origins, for
example `https://docs.example.com,https://example.com`. Origins do **not**
accept wildcard subdomains, trailing slashes, URL paths, queries or
credentials. Plain HTTP is accepted only for explicitly authorized loopback
origins, e.g. `http://127.0.0.1:3000`; all other selected origins must use
HTTPS. Then start `rtool mcp --local /your/approved/project`. Without both
the local folder opt-in and the allowlist plus installed Playwright, the
browser tools are absent; file/Git/Ollama capabilities remain independent.

The four read-oriented capabilities are `local.browser_status` (configured
origin visibility without navigation), `local.browser_visit` (bounded title
and page text), `local.browser_links` (up to 20 URLs whose final origins are
in the allowlist), and `local.browser_screenshot` (a single PNG capture).

Screenshots require `confirm:true` and a new relative `.png` `path`
beneath an already-existing directory in the approved root, optionally
selected with `root`. The original PNG bytes are never placed in an MCP
reply; it returns the path and byte count. Existing files, symlink escapes,
relative traversal, Git metadata and oversized images are refused.

Each navigation uses a fresh headless Chromium context, with no persisted
cookies/profile, downloads disabled, no automatic login or form entry,
service workers blocked and all network requests routed against the
owner-selected exact origins; any non-GET/HEAD request is blocked. WebSockets are closed. A page attempting
disallowed redirects/subresources refuses as a whole. The browser is closed
on success or failure; navigations have a bounded 1–15 second deadline.

These are **read-only browsing and capture tools**. They do not automatically
click buttons, enter passwords, approve account changes, or execute arbitrary
JavaScript supplied by an agent. The separate L-4 guided settings runner
requires a visible browser and independent owner approval for each step.

An origin allowlist is **not** a kernel-level network sandbox or proof against
compromised domains/DNS rebinding. Only approve websites you trust. Actual
installed-owner-machine Chromium operation, permissions and site behavior
require real external acceptance; unit/CI browser mocks alone do not prove
that acceptance. The optional local install is not permission for software
purchases or browser downloads by an agent.

References: https://playwright.dev/docs/browsers and
https://playwright.dev/docs/api/class-browsercontext.
