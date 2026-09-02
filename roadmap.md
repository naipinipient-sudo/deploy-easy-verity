# Verity MVP roadmap

- [x] DB schema: workspaces, members, roles, datasets, versions, findings, compare/recon, masters, audit
- [x] Auth: email/password, 2FA (TOTP), protected app shell
- [x] Upload: CSV/XLSX browser parse, profile, storage of raw rows, immutable versions
- [x] Mapping editor to canonical fields with confidence
- [x] Quality findings: missing required, invalid types, duplicates, unexpected categories
- [x] Compare two versions by business keys
- [x] Reconciliation run + approve/reject/override
- [x] Master dataset publish with lineage
- [x] Explore: table, filters, pivots, charts (bar/line/area/KPI), saved views, CSV/XLSX export
- [x] Rider performance: KPIs, ranking, period filter, drilldown to evidence
- [ ] AI analyst (PRD 8.11) — needs a Gemini API key; proxy via a Supabase Edge Function, never call from the client
- [x] Publish app (Netlify)
