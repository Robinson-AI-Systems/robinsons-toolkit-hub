# Execution cards — just in time

Same system as Appliance Desk and the Stripe MCP. The implementing agent writes a short card for the current unit and, when useful, its
immediate successor. Sol 5.6 at light/medium effort is the intended routine use. Avoid writing distant cards whose
prerequisites are hypothetical; `work-index.json` preserves all later scope. A missing card is work, not a reason to stop.
Designs govern behavior; cards cannot silently override them.

## Minimum card (usually 40–100 lines)

- ID, title, design section, prerequisites, "Baseline inspected" SHA.
- One risk area, migration ownership (if any), realistic budget (≤500 production lines).
- **Read only these:** a bounded list of design headings and files (with line ranges when long).
- Drift check A table (or "first card: no prior code").
- Build contract: files, exported signatures, which contract sections (`docs/CONTRACT.md` §n) it implements or relies on,
  pass and secret handling, which servers it talks to.
- Named tests: unit, door/conformance tests, db when SQL changes.
- Commands to run (with `set -o pipefail` when piping).
- Done when: observable conditions; what the successor inherits.

Validate coverage with `python3 docs/pr-cards/validate-index.py`.

## Effort guide for Sol 5.6

Light: docs cards, server plan cards (S), CLI commands following an existing pattern. Medium: passes and secrets, the
relay, federation, compound workflows, core extraction, local shell tools, anything touching SQL. A Sonnet/Opus second opinion is optional and limited to one
concrete question; no mandatory model switch.
