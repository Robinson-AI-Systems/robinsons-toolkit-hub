// An RTC manifest's canonical service ID can contain hyphens (for example,
// google-workspace-mcp). Do not use this for RTC tool names or prefixes:
// their separate underscore-only grammar remains unchanged.
// Keep this in sync with migration 020's database CHECK constraints.
export const serverNamePattern=/^[a-z][a-z0-9_-]{0,58}[a-z0-9_]$/;
