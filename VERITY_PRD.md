# Verity — Product Requirements Document

**Status:** Working product definition  
**Product:** Verity  
**Type:** Standalone data intelligence system  
**Primary principle:** Read, understand, reconcile, and explain operational data—never modify its source systems in the MVP.

## 1. Vision

Verity gives operations teams a trusted, explainable view of fragmented data. It turns files and exports from multiple systems into a governed workspace where users can standardize records, find quality issues, compare sources, reconcile discrepancies, build a master dataset, and ask evidence-backed questions.

Verity is separate from Dash Pulse in product, data, branding, access control, and roadmap. Dash Pulse may eventually consume a curated Verity output through an explicit integration, but it is not a Verity dependency and Verity is not a Dash Pulse feature.

## 2. Problem

Teams often reconcile CSV and spreadsheet exports manually. Columns differ, identities are inconsistent, rows are duplicated or missing, and explanations live in private spreadsheets. This makes reports slow, error-prone, and hard to audit.

## 3. Goals

- Create a shared, traceable workspace for operational datasets.
- Make ingestion and first useful insight possible in minutes, not days.
- Standardize heterogeneous source schemas into a canonical business model.
- Surface data quality problems and reconciliation exceptions clearly.
- Produce a master dataset with lineage to every source row and transformation.
- Enable self-service exploration, pivots, charts, rider performance analysis, and AI-assisted explanation.
- Preserve source data as immutable evidence.

## 4. Non-goals

- Replacing ERP, dispatch, marketplace, payroll, or other source systems.
- Writing back, updating, deleting, or creating records in source systems during MVP.
- Fully autonomous financial close or approval decisions.
- Building a generic BI platform before core reconciliation is reliable.

## 5. Target users

| User | Primary need |
| --- | --- |
| Operations manager | Trusted daily/weekly view across exports and vendors |
| Finance or reconciliation analyst | Find and resolve discrepancies with evidence |
| Data/BI analyst | Build governed master datasets and reusable views |
| Team lead / dispatcher | Review rider performance and operational exceptions |
| Executive | Understand metrics and their drivers without opaque summaries |

## 6. Product principles

1. **Evidence first.** Every aggregate, match, quality finding, and AI claim must be traceable to source records and transformation rules.
2. **Human-controlled.** AI recommends; users approve mappings, match resolutions, and publication.
3. **Read-only sources.** MVP imports copies of data; no source-system write-back is permitted.
4. **Progressive sophistication.** Useful browser-first MVP, scalable managed processing later.
5. **Workspace isolation.** Data, roles, rules, and AI context stay within their workspace.

## 7. Core experience

1. A user creates or joins a workspace, uploads CSV/XLSX exports, or imports a supported read-only export.
2. Verity profiles each file, detects sheets/headers/types, preserves the raw file, and proposes a schema mapping.
3. The user confirms canonical fields and normalization rules.
4. Verity creates quality findings, compares selected datasets, and proposes reconciliation matches.
5. Users resolve exceptions and publish a versioned master dataset.
6. Users explore the master dataset through tables, pivots, charts, rider-performance views, and AI questions with cited evidence.

## 8. Functional requirements

### 8.1 Workspace model

- A workspace is the top-level tenant for members, datasets, rules, analysis, and billing/usage.
- Roles: **Owner**, **Admin**, **Editor**, **Analyst**, and **Viewer**.
- Workspace-level configuration includes timezone, currency, canonical model, mappings, normalization dictionaries, and retention preferences.
- All material actions have an audit event: upload, mapping edit, normalization change, reconciliation decision, publish, and AI query.

### 8.2 Dataset ingestion

- MVP accepts CSV and XLSX uploads by drag-and-drop or file picker.
- An XLSX file may create one dataset per selected worksheet; blank/non-tabular sheets are flagged.
- Preserve the original file metadata, checksum, uploader, import time, and raw values.
- Show ingest status, row count, headers, sample rows, detected data types, parsing warnings, and duplicate-file detection.
- Imports are append-only versions. Re-uploading data never silently overwrites a prior dataset version.

### 8.3 Schema detection and canonical mapping

- Detect likely header row, data range, null rate, distinct count, value examples, and types: text, number, currency, date/time, boolean, identifier, category.
- Propose mapping from source columns to canonical fields using names, examples, and workspace history.
- Canonical fields include configurable entities such as record ID, transaction date, rider ID/name, order ID, amount, status, location, vendor/source, and period.
- Users can create custom canonical fields, split/merge source fields, set required fields, and save mappings as reusable templates.
- Mapping confidence is visible; unconfirmed mappings cannot be treated as certified data.

### 8.4 Normalization and transformation

- Apply explicit, versioned rules: trim/case normalization, date parsing/timezone conversion, currency/number parsing, category aliases, identifier cleanup, and controlled lookup tables.
- Preserve original value, normalized value, rule/version, and any error for each transformed field.
- Users preview impact before applying a rule and can roll back by creating a new version.

### 8.5 Data quality

- Profile completeness, validity, uniqueness, consistency, freshness, and distribution anomalies.
- Flag missing required values, invalid types, malformed identifiers, duplicate candidates, outliers, unexpected categories, and schema drift.
- Findings include severity, impacted rows, rule, evidence, status, assignee, and resolution note.
- Quality scorecards are informational; no automated source correction occurs.

### 8.6 Compare engine

- Let users compare two selected dataset versions or a dataset against a master dataset.
- Compare by chosen business keys, with configurable exact and normalized key rules.
- Report only-in-A, only-in-B, matching, changed-field, duplicate-key, and ambiguous-key results.
- Provide row-level drilldown and exportable exception lists.

### 8.7 Reconciliation

- Support exact matches and scored candidate matches across keys, dates, amounts, names, and custom fields.
- Reconciliation states: unmatched, proposed, matched, partially matched, ambiguous, excluded, and resolved.
- A user must approve, reject, or override proposed matches; overrides require an optional note and are audited.
- Show tolerance configuration for amounts/dates and explain the match score with contributing evidence.

### 8.8 Master dataset

- A master dataset is a named, versioned output assembled from mapped and validated source versions.
- Define merge precedence, deduplication keys, conflict handling, derived fields, and publish criteria.
- Every master row exposes lineage to contributing records, normalization rules, reconciliation decisions, and version timestamps.
- Publishing creates an immutable version. Consumers select a specific version or explicitly opt into latest approved.

### 8.9 Explore, pivots, and charts

- Browse/filter/sort a dataset, save views, and drill from aggregate to records.
- Build pivots with dimensions, measures, filters, grouping, and date periods.
- Provide sensible charts: table, bar, line, area, stacked bar, and KPI card.
- Exports are read-only CSV/XLSX snapshots with filters and master version recorded.

### 8.10 Rider performance

- Provide a rider-centric view when canonical rider fields are present.
- Show configurable KPIs such as jobs/orders, completed rate, cancellation rate, earnings/amount, active days, average turnaround, discrepancy count, and data-quality flags.
- Support ranking, trend comparison, period filters, and drilldown to source evidence.
- Do not use rider metrics for automated employment, compensation, disciplinary, or eligibility decisions.

### 8.11 AI analyst and evidence

- Gemini provides: screenshot/table extraction assistance, mapping suggestions, anomaly explanations, plain-language analysis, and answers to questions about the currently authorized workspace data.
- Screenshot extraction returns structured candidate values, confidence, source image reference, and human review state; it never silently becomes certified data.
- AI explanations must cite relevant dataset/master version, filters, rows or aggregates, and applied logic. Uncited claims are labeled as hypotheses.
- AI cannot publish a master dataset, modify mappings, resolve reconciliation, or write to a source system without a user action.
- Prompts and generated answers are logged according to workspace retention settings; sensitive fields are minimized/redacted where feasible.

## 9. Technical architecture

### 9.1 MVP architecture

**Lovable frontend** delivers the responsive web application: workspace UI, upload flow, mapping editor, tables, compare/reconciliation queues, exploration, charts, and AI interaction.

**Firebase Authentication** handles sign-in, session management, and identity. **Cloud Firestore** stores tenant-scoped metadata, configurations, audit events, findings, reconciliation decisions, saved analyses, and compact datasets/derived records within practical limits. Original uploads are stored in Firebase Cloud Storage (or an equivalent object store associated with the Firebase project), referenced from Firestore.

CSV/XLSX parsing, schema profiling, normalization preview, and small-to-medium compare operations run **in the browser** for the MVP. This keeps iteration fast and avoids sending raw data to a custom backend before users elect to import it. The application should use streaming/chunking where supported and clearly enforce browser-size limits.

Gemini is called through a controlled server-side integration/proxy or Firebase function, never directly with exposed credentials. Requests include the least data needed for the task.

### 9.2 Scale-out architecture

For large files, long-running processing, complex reconciliation, scheduled refreshes, or heavy chart preparation, move processing to a **FastAPI service on Cloud Run**.

- The frontend requests a job and receives status/progress updates.
- Cloud Run workers read immutable objects, write processed artifacts and results, and record job state in Firestore.
- Jobs are idempotent, versioned, retryable, and bound to a workspace and dataset version.
- Browser processing remains available for small files and offline-like previews.

This is an evolution path, not an MVP prerequisite. The client-facing product contract—immutable source versions, canonical mapping, lineage, and user approval—must remain the same across execution environments.

## 10. Data model (Firestore)

All documents carry `workspaceId`, timestamps, creator/actor IDs where appropriate, and a schema/version field.

| Collection | Purpose / key fields |
| --- | --- |
| `workspaces` | name, ownerId, timezone, currency, plan, settings |
| `workspaces/{id}/members` | userId, role, status |
| `workspaces/{id}/datasets` | name, sourceType, currentVersionId, canonicalModelId, status |
| `datasets/{id}/versions` | fileRef, checksum, sheet, rowCount, schemaProfile, mappingVersionId, processing status |
| `datasets/{id}/versions/{v}/rows` | raw/normalized row payload or pointers to partitioned artifact; lineage metadata |
| `mappingTemplates` | source signatures, canonical field mappings, confidence, version |
| `normalizationRules` | target field, rule config, active version, approval metadata |
| `qualityFindings` | datasetVersionId, rule, severity, row refs, status, resolution |
| `compareRuns` | left/right versions, keys, config, summary, artifact refs |
| `reconciliationRuns` | inputs, tolerance/match config, summary, status |
| `reconciliationItems` | candidate refs, score/explanation, state, decision/audit data |
| `masterDatasets` | name, definition, currentPublishedVersionId |
| `masterDatasets/{id}/versions` | inputs, build rules, lineage/artifact refs, publish state |
| `savedViews` | filters, columns, pivot/chart config, permission scope |
| `aiConversations` | prompt, response, citations, model metadata, retention state |
| `processingJobs` | execution mode, status, progress, retry/idempotency key, artifact refs |
| `auditEvents` | actor, action, object refs, before/after summaries, timestamp |

For large row sets, Firestore stores metadata and pointers to partitioned/columnar artifacts rather than forcing every record into a single document or query path.

## 11. Security and privacy

- Firebase Auth identity is required for all non-public access.
- Firestore and Storage rules enforce workspace membership and role-based permissions; users never query another workspace’s data.
- Owners/admins manage access; viewers cannot upload, edit mappings, resolve reconciliation, or publish.
- Encrypt data in transit and at rest using platform capabilities. Do not place API keys in the frontend.
- Keep raw uploads immutable and separate from derived results.
- Maintain audit logs for material actions; support configurable retention/deletion policies.
- Treat exports, screenshots, and AI context as sensitive workspace data. Use minimal disclosure, field-level redaction policies where needed, and vendor controls appropriate to the deployment.

## 12. Roadmap

### Phase 0 — Product foundation

- Workspace/member roles, Auth, security rules, audit model, canonical model v1.
- Lovable UI shell and source-version/lineage conventions.

### Phase 1 — MVP: browser-first trusted data

- CSV/XLSX upload and browser processing within published limits.
- Schema profile, mapping editor, normalization v1, quality checks.
- Dataset table, compare engine, manual/proposed reconciliation, master dataset v1.
- Basic explore/pivot/charts; rider-performance view when fields exist.
- Gemini AI explanation with citations and screenshot extraction review flow.

### Phase 2 — Reliability and collaboration

- Reusable mapping templates, richer match scoring, assignment/workflow for exceptions, saved/shared views, richer quality rules, exports, and monitoring.

### Phase 3 — Managed scale

- FastAPI on Cloud Run for asynchronous processing, large datasets, scheduled refresh, durable artifacts, and advanced reconciliation.

### Phase 4 — Carefully governed integrations

- Read-only connectors and API imports based on customer demand.
- Optional downstream publication/consumption interfaces after explicit governance review; source write-back remains a separate, opt-in future product decision.

## 13. MVP acceptance criteria

1. A signed-in editor can create a workspace and upload a CSV or XLSX file; the original and an immutable version record are retained.
2. The system displays detected columns, types, sample values, row count, and parse warnings, then lets the editor confirm a canonical mapping.
3. Normalization produces a preview and preserves original values and rule lineage.
4. Quality checks identify at least missing required values, invalid parsed values, duplicate candidates, and unexpected categories, with row drilldown.
5. A user can compare two dataset versions by selected keys and see matched, only-left, only-right, and changed-field exceptions.
6. A reconciliation run creates explainable proposed matches; a user can approve/reject/override them and the choice is audited.
7. A user can publish a versioned master dataset and trace a master row to source rows and rules.
8. A user can create a filtered table, simple pivot, and chart from an authorized dataset/master version.
9. When rider fields are mapped, the system provides configurable rider KPIs and underlying-record drilldown.
10. Gemini can extract candidates from a screenshot and answer a data question with explicit evidence/citations; it cannot make unapproved data changes.
11. Cross-workspace access is denied by Auth, Firestore, and Storage rules.
12. No MVP workflow writes back to, modifies, deletes, or creates data in a source system.

## 14. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Browser memory/performance on large XLSX files | Publish file/row limits, chunk parsing, show early warnings, add Cloud Run jobs in Phase 3 |
| Incorrect auto-mapping or AI extraction | Confidence indicators, preview, required human confirmation, preserve source evidence |
| False reconciliation matches | Conservative thresholds, explain scores, human approval, reversible versioned results |
| Firestore cost/query constraints for row-level data | Store metadata in Firestore; partition large derived artifacts and use purpose-built processing/query paths later |
| Sensitive operational data in AI prompts | Minimize payloads, use server-side controls, redaction policies, audit/retention controls |
| Scope creep into generic BI or source-system automation | Keep MVP focused on trusted data/reconciliation and prohibit source write-back |

## 15. Future integration philosophy

Verity should integrate only where it strengthens trusted, explainable data flows. Integrations begin read-only and import data as versioned evidence. Any downstream sharing uses explicit, versioned published outputs and clearly scoped permissions.

Direct write-back to source systems is explicitly out of scope for the MVP and must not be implied by imports, reconciliation, AI recommendations, exports, or future connector design. If explored later, it requires a separate product decision, per-connector authorization, approval workflow, idempotency and rollback design, comprehensive auditability, and customer-level opt-in.

