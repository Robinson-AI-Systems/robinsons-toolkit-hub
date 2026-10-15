# Local Ollama with `rtool mcp` (L-2)

This capability runs in the **local rtool process**, not Robinson's Toolkit
Hub, its Vercel host, GitHub relay, or a cloud model. Ollama is optional:
missing or invalid `OLLAMA_BASE_URL` hides only the six `local.ollama_*` tools.
Your file/Git tools and standalone RTC provider connections remain independent.

## Owner setup

1. Separately install and start Ollama on the computer that runs `rtool mcp`,
   then download a local model using Ollama's own documented tools. The
   assistant does **not** download a model or configure an account.
2. Set `OLLAMA_BASE_URL=http://127.0.0.1:11434` in the local process's
   environment (replace only the port if needed). The endpoint must be a
   loopback HTTP origin: `localhost`, `127.0.0.1`, or `[::1]`; no path,
   credentials, redirects, proxies or remote/cloud API endpoints.
3. Start `rtool mcp --local /your/approved/project`. This explicitly enables
   local capabilities for the selected approved root, unlike default
   `rtool mcp`, which has **no** local tools. The configured model must
   already appear in Ollama's `/api/tags` as downloaded with a real digest
   and positive size; missing models refuse rather than triggering downloads.

Use `local.ollama_status` to inspect the daemon version,
`local.ollama_models` for locally downloaded models,
`local.ollama_running` for loaded models, and then
`local.ollama_generate`, `local.ollama_chat` or `local.ollama_embed` with
an exact downloaded model name. Generation and chat use a single
nonstreaming bounded response, at most 512 predicted tokens and a default
20-second deadline. The timeout can be set between 1 and 60 seconds.

If complete generated content or embeddings exceed the inline cap, pass
`outputFile` (a relative destination beneath one approved root),
`confirm:true`, and optionally a `root` index. The file is created once
with restrictive permissions, never overwritten; the tool returns only the
path and byte count. Missing approval, stale/existing destinations, larger
than 16 KiB, outside roots or symlinks refuse. Inputs/prompts are sent
only to the local Ollama server; server passwords, RTC provider passes,
environment variables, Git credentials and file-tree contents are not sent.

No tool here can ask Ollama to pull or delete models, execute model-supplied
function calls, connect to an Ollama cloud endpoint, run shell commands or
perform a paid API operation. A local model may produce incorrect text;
developer acceptance and actual owner-PC/GPU performance must be evaluated
separately from synthetic HTTP/CI proof.

Official API references: https://docs.ollama.com/api/introduction and
https://docs.ollama.com/api/chat.
