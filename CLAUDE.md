# HARD RULE: no new sections

Owner, 2026-10-06: do NOT add a section, page, tab, nav entry, panel, card, drawer, modal or any
other new surface unless the owner explicitly says "add a section" or names the new page. A feature
request is a change to the place where that work ALREADY lives. Cannot see how to do it without a
new surface? ASK which surface, and build nothing until he answers. Adding a surface he did not ask
for is a defect; removing one he did not ask for is a fix. Every repo, every agent, every session.

---

# READ FIRST: Airtable is RETIRED

Airtable is defunct. It is fully phased out. There is no Airtable any more.

- Do NOT read from it, write to it, call its API, add config or secrets for it, or mention it in new code,
  comments, prompts, docs, error messages, commit messages or replies.
- Do NOT suggest changing it, syncing it, or "also updating" it when asked to change something. Do not ask
  whether to update it. Never raise it as a caveat.
- The system of record is Cloudflare D1 (database `leafylink`), reached through the Manager (`/api/...`)
  or the D1 binding. Client roster: `mgr_x_clients`. Catalog and moments: `moment`, `mgr_x_raw_clips`.
  Sequences: `mgr_x_sequences`. (The `mgr_x_*` names are historical; those ARE the real tables now.)
- Any reference left in this repo is legacy waiting to be removed (inventory: todo-docs/AIRTABLE-RETIREMENT-INVENTORY.md).
  Do not copy it, extend it, or "repair" it. If you touch one, delete it and move the logic to D1.
- If a task seems to need it, use D1 and say nothing about it.

---

