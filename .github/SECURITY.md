# Security policy

No released version currently has a security-support commitment. Supported versions and any maintenance period must be stated when releases are introduced; an old build or a passing test run does not establish support.

## Report privately

GitHub private vulnerability reporting is the selected reporting channel for the public repository. Once it is enabled, use **Report a vulnerability** on the repository's Security page, or [start a private report](https://github.com/noldova-com/teamrun/security/advisories/new).

The reporting channel has not been verified as available for this new repository. GitHub provides this feature for public repositories, and publishing this file does not enable it. As part of public launch, maintainers must enable reporting, verify the reporting path and arrange to receive its notifications. See [GitHub's configuration guidance](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

If the private reporting option is unavailable, ask maintainers for a secure reporting channel. An issue may ask for a security contact, but must not include vulnerability details, affected private data or a proof of concept. Wait for a confirmed private channel before sending those details. No alternative email address is designated by this policy.

## What to include

Provide enough information to assess and reproduce the problem:

- The affected version or commit and where the build came from.
- The operating system, CPU architecture and relevant provider or harness version.
- The affected component, required access or configuration, and likely impact.
- Minimal reproduction steps using synthetic data and a disposable project.
- Relevant redacted diagnostics and any safe workaround you have identified.

Do not send real credentials, provider profile files, private conversations or a TeamRun data directory. Share only the information needed to reproduce the problem. Assess only systems and data you own or have permission to test.

## Handling and disclosure

Keep vulnerability details and proposed fixes in the private reporting channel while maintainers and the reporter assess impact, reproduction and remediation. Do not put sensitive details in public issues, branches, PRs or logs before coordinated disclosure. Public tracking can link to the advisory once disclosure is appropriate.

Maintainers and the reporter should agree on disclosure timing and credit, and record affected versions and available fixes or mitigations in the advisory. Acknowledgement and remediation depend on impact and maintainer capacity; this policy offers no response-time or fix-date guarantee.

Ordinary bugs, feature requests and usage questions follow the [contribution and support guide](CONTRIBUTING.md). If a report may expose a security weakness, use the private reporting route first.
