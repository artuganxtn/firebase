# ORIN 1.5.4 - Email-code registration

## Status
Implemented and tested locally. Not deployed or activated in the delivered APK. The Firebase project is still on Spark with no configured sender. Existing Firebase email verification by link remains available; the numeric-code field explicitly shows that it is unavailable. No mock code, success message or email-verification bypass is used.

## Activation prerequisites
- A production backend that can run `orinIdentity` (this Firebase Functions deployment requires a billing-enabled project). Do not change billing without the account owner's approval.
- A Resend account with a verified sending domain and a transactional API key. Other mail providers may replace the small server-side mail adapter.
- Secrets `ORIN_MAIL_API_KEY` and `ORIN_EMAIL_CODE_SECRET` (at least 32 random characters) set using the deployment secret manager. Never put either secret in the web app, APK, source archive, or chat.
- Server parameters `ORIN_MAIL_FROM` (verified sender) and `ORIN_EMAIL_CODES_ENABLED=true`.
- Firestore collections `orinEmailChallenges` and `orinEmailRates` must remain server-only; existing catch-all deny rules cover them. Configure Firestore TTL on `expiresAt` for both collections. Expiry is enforced by the server even without TTL.
- The deployed runtime service account must be able to create users and sign Firebase custom tokens with the narrowly scoped IAM role required by Firebase.
- Only after deployment and a real delivery test, build the app with `VITE_ORIN_IDENTITY_API_URL=https://europe-west1-orin-99951.cloudfunctions.net/orinIdentity`. No other production endpoint is accepted by the client.

## Endpoints
`POST /send-code` accepts `{email}`. It returns a random challenge ID, 600-second code lifetime and 60-second resend cooldown only after the mail provider accepts the request. Provider acceptance is not a guarantee of inbox delivery.

`POST /register` accepts `{email,name,password,code,challengeId}`. The server atomically consumes a correct, unexpired code, creates a verified Firebase user, and returns a Firebase custom token. No roles, balance, referral rewards or elevated claims are granted. If the response fails after account creation, the user can log in with the chosen credentials.

## Security and release checks
- Cryptographically random six-digit codes and 192-bit challenge IDs.
- Code hashes bind email, challenge and secret; no plain code, password or token is persisted or logged.
- Five failed guesses lock a challenge; failures are committed even when the request is rejected.
- Limits: one email per minute, three per email/hour, ten per IP/hour, 200 per project/day. Firestore transactions enforce limits across instances.
- Strict production origin allowlist, JSON body size limit, network timeouts, single-use verification, idempotency keys for mail submission.
- Test real email receipt, expiry, resend, changed email, duplicate sign-up, and interrupted sign-in on Android before activation. Local tests use a transactional fake and a stub mailer; they do not certify production delivery or Firestore deployment.

Official references:
- https://firebase.google.com/docs/auth/admin/manage-users
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://resend.com/docs/api-reference/emails/send-email
