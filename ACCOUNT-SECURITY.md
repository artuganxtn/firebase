# ORIN account-security authority — 1.6.0 implementation

## Delivery status

Implemented server logic is exercised against the Firebase Auth and Firestore **emulators**, including independently generated ECDSA WebAuthn assertions. This is not evidence of a deployed production security authority or a physical authenticator/Android acceptance test. Production activation remains coordinated with the strict rules, upgraded client, Firebase Functions billing/runtime/IAM, and host configuration. No production customer records or funds were changed by these tests.

`orinSecurity` is a separate HTTPS function. Its endpoints fail closed until all of:

- `ORIN_ACCOUNT_SECURITY_ENABLED=true` in the deployed environment.
- A Secret Manager secret named `ORIN_SECURITY_MASTER_KEY`, containing exactly32 cryptographically random bytes encoded as standard Base64. This is a server-generated encryption key, **not an external API key**; do not commit it, ship it to Android, log it, or regenerate it on each start. Keep protected backups; replacing it without migration prevents existing TOTP ciphertext from being decrypted.
- The server-owned Firestore document `system/account-security` is `{enabled:true,rulesVersion:160}`. A deployer must create this only after verifying the strict rules and authority/client rollout. The endpoint never self-activates.
- The HTTPS origin is one of the explicitly permitted ORIN application origins. WebAuthn additionally requires a canonical `ORIN_WEBAUTHN_ORIGIN` and matching `ORIN_WEBAUTHN_RP_ID`; no origin supplied by a client becomes trusted.

Set `ORIN_WEBAUTHN_ORIGIN=https://orin-99951.firebaseapp.com` and `ORIN_WEBAUTHN_RP_ID=orin-99951.firebaseapp.com` only if that is the chosen permanent login origin. Keys are scoped to this RP and won't automatically work on `web.app` or an unrelated Android asset origin. Native Android Credential Manager/Digital Asset Links integration remains a separate integration if a WebView cannot support WebAuthn. The frontend must report unsupported devices honestly.

## Session authority and refresh tokens

1. Login receives a recently authenticated Firebase **primary-provider** token (age at most120seconds, custom/sid tokens rejected). The primary auth event can bootstrap an ORIN session only once.
2. If TOTP is enabled, no ORIN session or custom Firebase token is issued until the TOTP/recovery challenge succeeds. An explicitly remembered device is allowed only with a random256bit proof token, matching user, epoch, expiry and non-revoked server record, plus the fresh primary credential.
3. Server creates a random sid, independent256bit access/refresh credentials and hashes only the credentials in Firestore. It returns a Firebase custom token carrying `sid` and `security_epoch`.
4. Protected HTTP requires the Firebase sid token and `X-Orin-Session` access proof. Firestore's strict rules consult the same active sid/uid/expiry/epoch; a password-only token cannot read private data.
5. Access lifetime is1hour, absolute session lifetime30days. Refresh rotates both opaque secrets; previous access is accepted only for at most30seconds (never beyond its prior expiry) so concurrent in-flight requests don't fail. Previous refresh-token replay revokes the session. Refresh requests must be single-flight on a client.
6. Logout/revoke changes the actual server session. Another device cannot revoke a session owned by a different user. Logout-others processes every matching session, not just the first page.
7. Firebase provides global `revokeRefreshTokens(uid)`, not individual refresh-token revocation. ORIN revokes the sid grant: an underlying Firebase refresh token may still mint a token, but its sid is denied by ORIN APIs and strict rules. This distinction must never be described as per-token Firebase deletion.
8. A snapshot of Firebase `tokensValidAfterTime` is bound to each session and pending primary+MFA challenge. External provider revocation makes opaque refresh fail and marks the sid revoked, preventing custom-token reminting from resurrecting the session. Provider timestamp resolution is one second. ORIN-controlled account-wide revocation additionally increments the Firestore epoch transactionally for immediate rules enforcement.

Device model/manufacturer/platform/version are client-reported metadata, explicitly **not** authentication proof. No GPS is collected. Sessions record the real server-observed clientIP only when ingress trust is configured. The raw transport peer is kept separately and is not mislabeled as a user's IP.

## Trusted proxy/client IP

The resolver never accepts arbitrary X-Forwarded-For or the first client-supplied address. Behind an unknown proxy it returns `ip:null`, `ipSource:'unavailable'` while preserving transport metadata internally. This avoids inventing a client IP or collapsing every customer into one proxy-IP rate-limit bucket.

For a dedicated, non-bypassable ingress, the deployer may set `ORIN_TRUSTED_PROXY_IPS` to exact trusted socket peer IPs and `ORIN_TRUSTED_PROXY_HOPS` to the number of **verified appended hops**,1–5. All forwarded values must be valid IPs. Block direct access to the function; a hop count alone is never a trust boundary. Alternatively `ORIN_DIRECT_CLIENT_IP=true` is only for an actual directly connected server; requests carrying forwarded headers still aren't treated as direct clients.

Google's external Application Load Balancer appends client and load-balancer addresses after any untrusted supplied values. Configure from actual deployed ingress topology, not assumed Firebase Hosting behavior:
https://docs.cloud.google.com/load-balancing/docs/https#x-forwarded-for_header

No GeoIP database is installed. `approximateLocation:null`, `geoIP:false`. A licensed, locally updated GeoIP database (for example MaxMind GeoLite2 with its applicable download/license setup) is required for city/country; never infer GPS. Trusted-IP budgets are300/min; authenticated account budgets60/min; OTP failures have an independent escalating persisted delay. Unknown proxy addresses are never pooled into a60/min global user bucket. Production edge abuse protection is also recommended for public challenge creation.

## TOTP, recovery, step-up and WebAuthn

- RFC4226/RFC6238, SHA1/6digits/30seconds, one-step clock window. The last accepted counter is updated in the same Firestore transaction, rejecting replay even concurrently.
- Enrollment secrets are random160bit, AES256GCM encrypted with user-bound AAD. Enrollment expires5minutes and allows at most5attempts. Status stays disabled until the first correct code. Enabling revokes other existing sessions and previously remembered device proofs. A factor-version increment invalidates outstanding grants and registration challenges issued under the previous MFA policy.
- Ten independent96bit recovery codes are displayed once. Only domain-separated SHA256 digests of these high-entropy codes persist. Consumption and replacement are atomic; concurrent uses admit at most one. Never use these functions to hash low-entropy PINs/passwords.
- Step-up grants are random, hashed, single-use, action+uid+sid+epoch-bound and expire2minutes. Where a financial action is transactional, consume its grant in the same Firestore transaction as the write. TOTP/recovery/passkey verification is required once MFA is enrolled; an ordinary recent password proof cannot bypass it. Otherwise a fresh primary credential is required.
- WebAuthn uses pinned `@simplewebauthn/server`13.2.2, required user verification, exact RP/origin, challenge one-time use/5minute expiry, credential ownership, signature and counter verification. Stored data is public-key material only. Registration and authentication recheck active-session/epoch transactionally before changing security state.
- Passwordless discoverable-passkey login is implemented at `passkeys/login/options` and `passkeys/login/verify`. Authenticator user verification is required. It is not simulated biometric verification.
- Removing trust revokes sessions created by that remembered-device proof. Fresh primary+removed proof returns the MFA challenge again. Device names alone never authorize trust.
- Password change calls Firebase Admin after a valid one-time grant, globally revokes provider refresh tokens, then increments the ORIN account epoch; subsequent login is required.

## API contract

Base `/api/security/`. Protected requests use `Authorization: Bearer <Firebase sid IDtoken>` and `X-Orin-Session: <accessToken>`. POST bodies are bounded JSON. All responses are no-store.

| Route | Body/result |
|---|---|
| GET state | `SecurityState` from `lib/account-security-types.ts` |
| POST login | Fresh primary bearer; `{device,trustedDevice?:{id,deviceToken}}`; session bundle or MFA challenge |
| POST login/complete | `{challengeId,otp? ,recoveryCode?}`; session bundle |
| POST refresh | `{sessionId,refreshToken}`; rotated session bundle |
| POST logout / logout-others | `{}` |
| POST session/revoke | `{sessionId}` |
| POST step-up | `{action,freshFirebaseToken? ,otp? ,recoveryCode?}`; `{stepUpToken,expiresAt}` |
| POST totp/enroll | `{stepUpToken}`; `{enrollmentId,secret,otpauthUri}` |
| POST totp/verify | `{enrollmentId,otp}`; `{ok,recoveryCodes}` shown once |
| POST totp/disable | `{stepUpToken}` |
| POST recovery/regenerate | `{stepUpToken}`; `{recoveryCodes}` shown once |
| POST passkeys/options | `{stepUpToken,name}`; `{challengeId,options}` |
| POST passkeys/verify | `{challengeId,response}` registration response |
| POST passkeys/delete | `{id,stepUpToken}` |
| POST passkeys/auth/options | `{action}`; `{challengeId,options}` |
| POST passkeys/auth/verify | `{challengeId,response}`; step-up grant |
| POST passkeys/login/options | `{}`; public discoverable authentication options |
| POST passkeys/login/verify | `{challengeId,response,device}`; session bundle |
| POST trusted/add | `{name,stepUpToken}`; `{id,deviceToken,expiresAt}` store securely |
| POST trusted/prove | `{id,deviceToken}` after login; updates actual last use |
| POST trusted/delete | `{id,stepUpToken}`; remove local proof too |
| POST password/change | `{password,stepUpToken}`; `{ok,requiresLogin:true}` |

Error bodies have a safe message and code, including `invalid-session`, `session-revoked`, `session-expired`, `invalid-otp`, `recent-auth-required`; an incorrect OTP must not be confused with global session revocation. HTTP429 means persisted rate limiting.

## Audit and provider boundaries

Audit payloads are explicitly constructed safe fields; password, PIN, OTP, TOTP secret, recovery values, opaque proofs, and private keys are never copied into events. Password failures that occur directly at Firebase Auth before this authority is called cannot truthfully be recorded as server-verified ORIN password failures. Actual ORIN second-factor and WebAuthn login failures are audited. Full upstream failed-password audit requires Firebase/Identity Platform audit integration; don't accept unauthenticated client failure reports as authoritative activity for another user's account.

The existing Firebase password Auth provider still allows its own identity-management API paths. ORIN's custom TOTP protects ORIN private data/actions through sid rules, but is **not Firebase provider-native MFA**. For100% provider-level enforcement (including Firebase's own direct password-change/account APIs), adopt Firebase Authentication with Identity Platform TOTP MFA or migrate primary authentication into a backend that owns the whole credential lifecycle. This is an architectural limitation, not fixed by flipping a UI flag. Keep it explicit in release status.

## Verification

Run `scripts/test-security-backend.sh` with Java21 on PATH for Firebase emulator support. Dependencies: project root test toolchain and `npm ci --prefix firebase-functions`. The tests use project `demo-orin-security` and isolated emulator ports9198/8188, never production. They test RFC vectors, encryption/tamper/user binding, recovery entropy/hashes, proxy spoof rejection, sid bypass and cross-user isolation, persisted revocation, TOTP enrollment/replay, concurrent one-time recovery, action-scoped grants, actual remembered-device login/removal, revocation during enrollment, WebAuthn signatures/RP/origin/challenge replay, passkey login, access overlap/refresh replay, and provider revocation of active/pending sessions.

A physical Android biometric/passkey test and actual deployed multi-device session test remain separate acceptance gates. Do not mark them passed from emulator output.
