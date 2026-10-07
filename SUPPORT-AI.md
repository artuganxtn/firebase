# Adam — ORIN support, release 1.6.1

Adam is ORIN's automated, read-only support assistant. The client uses the name Adam / آدم and ORIN support branding. The immutable server prompt requires an honest answer if asked whether Adam is automated; it forbids pretending to be human. Provider readiness is queried from the actual configured model. A compiled screen or saved customer message is not an active model or a human presence.

## Runtime and credentials

- Trusted ORIN API with real ORIN session/MFA enforcement is required. `supportAssistantCapability`, `supportAssistantReply` and `supportEscalate` default to `securityEnforced=false` and fail closed. Session ownership/revocation is checked again for scoped tools and before saving any answer.
- Gemini: set server-only `ORIN_SUPPORT_AI_ENABLED=true`, `ORIN_SUPPORT_AI_PROVIDER=gemini` and bind Secret Manager **ORIN_SUPPORT_AI_API_KEY** to the exported API function. Never expose it in Vite variables, client files, APK assets, Firestore configuration, prompts or logs. The default `gemini-3.5-flash-lite` is configurable among approved models. Root-managed credentials are never included in this source bundle.
- Gemini requests use the fixed `generativelanguage.googleapis.com/v1beta/models/...` endpoint, `x-goog-api-key` header, native JSON schema output and native `streamGenerateContent` SSE. `store:false` requests provider logging opt-out according to the current official request schema; account/provider policies still need operator review.
- The existing self-hosted OpenAI-compatible path remains: `ORIN_SUPPORT_AI_PROVIDER=openai-compatible`, exact HTTPS `ORIN_SUPPORT_AI_ENDPOINT`, `ORIN_SUPPORT_AI_ALLOWED_ORIGINS`, `ORIN_SUPPORT_AI_MODEL`, optional server-only `ORIN_SUPPORT_AI_TOKEN`. No client-controlled endpoint, URL fetching or redirects.
- Runtime configuration is stored at `orinSupportConfiguration/current`: enabled, provider, model, maxTokensPerReply, dailyTokenBudget, systemInstructions, plus admin audit metadata. Environment enablement is an additional gate. Credentials are never stored there. Operator instructions are lower-priority guidance and cannot replace immutable boundaries.
- Health timeout is 15 seconds, inference timeout 25 seconds, responses at most 64 KiB, validated text at most 2,000 characters, output token limit 128–2,048. Positive health cache 30 seconds, failures 5 seconds.

## API and streaming

- GET `/api/support/assistant`: actual capability plus current active ticket.
- POST `/api/support/assistant` `{messageId}`: process this caller's existing customer message. The HTTP handler passes `supportAssistantReply(identity, body, true, {onChunk})` after security enforcement.
- SSE events: `status` with reading/generating/saving; `delta` with the entire **validated and persisted** answer; `complete` with result. The provider's real SSE is buffered until schema, citations and sensitive-output checks pass. Status events reflect actual processing. No fake token animation and no raw unvalidated credential fragments are sent to the client.
- POST `/api/support/escalate` `{messageId?}` creates/reuses an actual `orinControlTickets` record. Explicit escalation without previous messages creates the actual customer handoff-request message and exact support thread envelope. The response returns ticket ID/status/time.
- A provider outage returns `unavailable`, keeps the customer message and permits a same-message retry after 3–5 seconds. It does **not** force a permanent human takeover. Explicit user escalation or a validated answer requesting staff creates the ticket. A successful job is idempotent and never creates a second final reply.

## Grounding and allowed tools

Reviewed release knowledge: `lib/support-knowledge.ts`. Editable reviewed knowledge: `orinSupportKnowledge/{id}`, published status + reviewed flag, revision, title <=120 characters and content <=4,000. Up to six relevant reviewed documents are retrieved with bounded context; drafts are excluded. Immutable app/security guidance remains present. Admin content is still untrusted data, never instructions to access more records.

Read-only server tools: getAccountStatus, getDepositStatus, getWithdrawalStatus, getReferralStatus, getActiveSessions, getServiceStatus, getPaymentStatus. Tool selection uses the current question plus recent context in Arabic/English/Turkish/German. Each tool derives UID exclusively from verified Identity and rechecks account/session authorization. No model-supplied UID/path is accepted. Validated specific payment references are scoped again by owner; otherwise financial results explicitly cover only the most recent five recorded requests.

Only minimized status data is returned. Payment destinations, credentials, TOTP secrets, recovery hashes, session token hashes, exact IPs, customer contact details and other customers' records are excluded. The assistant cannot change balances, approve/reconcile payments, withdraw, trade, reset credentials or revoke sessions. Missing data is unknown, never a zero or success. The separately deployed payment function's credential availability cannot be inferred from this process; payment readiness remains an authenticated payment-screen check.

Messages sent to inference are redacted for email/URLs, labeled passwords/PINs/OTPs, long identifiers and ORIN recovery-code formats. Redaction is an additional safeguard, not a guarantee of detecting arbitrary unlabeled personal secrets. The UI must continue warning users not to submit credentials.

## Persistence and limits

- `orinSupportAssistantJobs/{uid}/messages/{messageId}`: leases, idempotency, citation/tool/version/provider provenance and bounded diagnostic codes; no prompt or credential logging.
- `orinSupportAssistantLimits/{uid}`: one in-flight request, >=3 seconds between requests, <=20 requests/hour.
- `orinSupportUsage/{UTC-date}`: actual inputTokens/outputTokens/totalTokens, requests/failures, reservedTokens, budgetDebitedTokens and unmeasuredTokens. Reserve a conservative encoded-input upper bound plus output budget before inference. Settle against measured usage when returned. Unknown usage is conservatively charged; stale crashed reservations are released and conservatively debited before retry. These are spending controls, not provider billing invoices.
- `orinSupportErrors/{id}`: bounded code, timestamp, provider/model and internal reference only. No body, prompt, raw provider errors or stack traces.
- `orinSupportEscalations/{uid}` links to the actual ticket. Tickets include `source:'orin-ai'`, conversationId, redacted conversation excerpts and existing control-center workflow fields. Existing six-field support thread format is preserved. Human takeover wins over an in-flight answer. Admin resumption requires an audited explicit workflow after the linked ticket is resolved/closed.
- Clients must be denied writes to assistant jobs/usage/errors/config/KB/ticket link records and cannot create assistant messages. Admin SDK is the authority.

## Verification

`tests/support-assistant.test.mjs` covers providers, schema, endpoint boundaries, secrets, Arabic streaming, languages and recovery-code redaction. `tests/support-assistant-firestore.test.mjs` runs only against a demo Firestore emulator: ownership, actual stored replies, idempotency/concurrency, unchanged funds, read-only tool isolation, reviewed KB, real ticket persistence, usage reservations, outages/recovery, human takeover and revocation during inference. Provider mocks exist only in tests. Root-managed live-provider/HTTP evidence and physical Android acceptance are separate; this document does not claim production deployment or device acceptance.

Official protocol references checked October 6, 2026:
https://ai.google.dev/gemini-api/docs/models
https://ai.google.dev/api/generate-content
https://ai.google.dev/gemini-api/docs/structured-output
https://ai.google.dev/gemini-api/docs/api-key
https://docs.vllm.ai/en/stable/serving/openai_compatible_server/
