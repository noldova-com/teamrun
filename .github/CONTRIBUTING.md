# Contributing to TeamRun

See the [README](../README.md) for TeamRun's purpose and product direction. Contributions follow the issue and PR workflow below.

## Issues and support

Use [GitHub Issues](https://github.com/noldova-com/teamrun/issues) for bugs, change requests, development tasks and questions. Search first and add relevant details to an existing report where appropriate. Security concerns follow [SECURITY.md](SECURITY.md) before opening an issue or PR.

Describe the problem or request; maintainers handle triage, missing information, labels, milestones and sub-issues. An open issue is not an implementation commitment. You need not assign labels or milestones, and there is no separate project board or repository roadmap to update.

For a bug, include:

- The expected behavior, actual behavior and smallest reliable reproduction.
- The TeamRun version or commit and where the build came from, when reporting application behavior.
- The operating system, CPU architecture and installation format, where relevant.
- The relevant provider and harness version, without credentials or provider profile files.
- A short redacted log excerpt or screenshot if it helps explain the failure.

Change requests describe the use case, desired outcome and workaround. Questions explain the goal and difficulty; documentation reports identify the file and passage. Use a matching issue form if available, or a plain issue with the same information.

Use synthetic data and a disposable project for reproductions. Review logs, screenshots and attached files before sharing; remove secrets and unrelated personal or project information. Do not upload real conversations, provider profiles or TeamRun data directories. Support is provided on a best-effort basis, with no response-time commitment.

## Before making a change

Create or reuse a relevant issue in this repository for every change, including documentation, small fixes, dependencies and agent-assisted work. Discuss substantial product or architecture changes in the issue before implementing them. Agree on a bounded scope and observable acceptance criteria; split larger work into linked issues when needed.

Follow the [coding standards](../docs/CODING-STANDARDS.md), the [UI standards](../docs/UI-STANDARDS.md) for visual and interaction changes, and the [architecture](../docs/ARCHITECTURE.md) for changes to component or data boundaries. Update the owning document when a requirement changes instead of adding a competing rule elsewhere.

Dependency updates are proposed and reviewed manually through the same issue and PR workflow. Review their compatibility, installation behavior and verification needs under the coding standards.

## Pull requests

Work on a focused branch in your fork, or a repository branch when you have the necessary access. Open the PR against `main`. Contributors do not need access to a maintainer's checkout; maintainers and agents working in a shared checkout follow [AGENTS.md](../AGENTS.md).

Each PR description includes a standalone line with its actual tracking issue:

```text
Issue: #123
```

Replace `123` with an existing issue from this repository, not a PR or another repository's issue. Link additional issues as needed. Add `Closes #123` only when completing its scope; partial work leaves it open. Reviewers verify relevance.

Describe the problem, resulting behavior, verification and remaining limitations. Keep the change small enough to review coherently. Include before/after screenshots for visual changes when useful, using disposable data. Commit messages describe the concrete change.

AI-assisted contributions are welcome. Explain material AI involvement and how you reviewed and verified the result. The contributor remains responsible for correctness, security and licensing; no authorship label is required. Keep discussion constructive and address findings on their merits.

An authorized human reviews and merges changes after the applicable requirements are met. A passing check does not authorize a release or establish that behavior outside the check's scope works.

## Verification

For documentation-only changes, check accuracy, internal consistency, links and formatting. Do not invent build commands or describe unimplemented behavior as tested.

Use the revision's documented toolchain, setup and check commands, including required build-before-test order. Follow the coding standards for test authoring and [TESTING.md](../docs/TESTING.md) for execution, coverage and verification scope. Ordinary checks use disposable fixtures without provider sign-in or paid turns.

Record the tested revision/snapshot, commands, outcomes and limitations in the issue or PR, linking CI results and selected redacted evidence. Follow TESTING.md's evidence rules: identify the kind of verification, preserve unexplained failures and state which checks could not run.

## Licensing

Contributions to TeamRun's own code and documentation follow the [MIT License](../LICENSE). Introduce third-party material only when you have the necessary rights and have reviewed its license; preserve required notices and record its source. See the coding standards for dependency, source and generated-file requirements.
