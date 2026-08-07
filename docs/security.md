# Security model

This is a release-candidate security overview, not a certification or penetration-test report.

## Trust boundaries

- Firebase Auth UID is the canonical identity for Firestore, Storage, Functions and RevenueCat.
- Firestore and Storage rules authorize every direct client operation.
- Sensitive state transitions—messages, premium chat requests, moderation, counters and account deletion—run in Cloud Functions.
- Premium access comes from the RevenueCat-managed `activeEntitlements` custom claim.
- Administrative access comes only from the separately provisioned `sparkAdmin: true` custom claim.

## Data minimization

- Email, login metadata, birth date, device tokens and preferences are owner-readable only.
- Discoverable profiles omit email and birth date. Location is rounded to two decimal places before publication.
- Analytics and Crashlytics SDKs are excluded until Spark has a granular consent and opt-out flow.
- AdMob starts only after UMP consent information is available and requests non-personalized ads.

## Repository hygiene

Firebase mobile config files and client SDK keys are identifiers used by shipped apps, not server credentials. Restrict them by bundle/package and API in provider consoles. Private service accounts, APNs keys, certificates, keystores, provisioning profiles, local environment files and Terraform state must never be committed.

## Production blockers

- Enforce Firebase App Check for Firestore, Storage and callable Functions after physical-device testing.
- Add automated Firestore Rules tests for cross-user reads/writes and custom-claim boundaries.
- Validate uploaded image bytes, strip metadata and add abuse/malware scanning rather than trusting MIME type alone.
- Replace the single-admin operational model with least-privilege roles, MFA, audited claim provisioning and access reviews.
- Define report, billing, backup and deletion retention periods; test deletion against production-like data.
- Add privacy-preserving error monitoring only after consent design and data-processing review.
- Run dependency, secret and static-analysis checks in CI and complete an independent security assessment.

Report vulnerabilities privately to the repository owner. Do not put credentials, exploit details or personal data in a public issue.
