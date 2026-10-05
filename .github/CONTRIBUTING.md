# Contributing to TeamRun

The [README](../README.md) introduces TeamRun. Contributions follow this issue and PR workflow.

## Issues and support

Use [GitHub Issues](https://github.com/noldova-com/teamrun/issues) for bugs, changes, tasks and questions. Search first and extend relevant reports. Security concerns follow [SECURITY.md](SECURITY.md) before any public issue/PR.

Describe the problem; maintainers handle triage, missing information, labels, milestones and sub-issues. An issue does not promise implementation. No separate board or roadmap needs updating.

For a bug, include:

- The expected behavior, actual behavior and smallest reliable reproduction.
- The TeamRun version or commit and where the build came from, when reporting application behavior.
- The operating system, CPU architecture and installation format, where relevant.
- The relevant provider and harness version, without credentials or provider profile files.
- A short redacted log excerpt or screenshot if it helps explain the failure.

Changes describe the use case, outcome and workaround; questions explain the goal and difficulty; documentation reports name the passage. Use the matching form or a plain issue with the same information.

Reproduce with synthetic data and a disposable project. Redact logs, screenshots and attachments; never upload real conversations, provider profiles or data directories. Support is best-effort without a response-time commitment.

### Labels and triage

Submit without labels or milestones if needed; maintainers manage them:

- `needs triage` marks a report awaiting assessment; remove it after that assessment.
- `needs information` marks missing details and stays until the required information is supplied.
- `good first issue` identifies clearly scoped work suitable for newcomers, with enough guidance to get started.
- `in progress` marks an issue someone is working on; see [Before making a change](#before-making-a-change).

The [labels page](https://github.com/noldova-com/teamrun/labels) describes each label's meaning.

## Before making a change

Every change—including docs, small fixes, dependencies and agent work—needs a repository issue. Discuss substantial product/architecture changes before implementation. Agree on bounded scope and observable acceptance criteria; split larger work into linked issues.

Start only if the issue has no `in progress` label or open PR, then label your issue/sub-issue. The **Clear work labels** workflow removes it and `paused` on closure; remove it yourself when ending work on an open issue. If unable to label, comment that you are working on it.

Follow the [coding standards](../docs/CODING-STANDARDS.md), [UI standards](../docs/UI-STANDARDS.md) for visual/interaction changes, [architecture](../docs/ARCHITECTURE.md) for boundary changes, and affected module documents. Update each rule's owner rather than adding competing rules.

Propose and review dependency updates manually through this workflow, checking compatibility, installation and verification under the coding standards.

### Module versions

Each module's version is the `version` in its `module.json` ([architecture](../docs/ARCHITECTURE.md#modules-and-versions)). Every module starts at 0.0.1 and keeps it until the maintainer decides to raise it. Raise a version only in a change the maintainer approved, by editing that field; the build carries it to the module's packages, its declarations and its status, so nothing else changes with it.

## Pull requests

Use a focused fork or authorized repository branch; target `main`. Work inside one follows [AGENTS.md](../AGENTS.md).

Each PR description includes a standalone line with its actual tracking issue. Use either form when the issue should stay open:

```text
Issue: #123
Issue #123
```

When the PR completes the issue, a GitHub closing reference such as `Closes #123` is sufficient on its own; no separate `Issue` line is needed. Accepted closing keywords are `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves` and `resolved`. Matching is case-insensitive and the colon is optional, for example `FIXES: #123`. Closing references close the issue when the PR merges into `main`; use an `Issue` reference for partial work.

Replace `123` with an existing issue from this repository, not a PR or another repository's issue. The first such line counts; references in HTML comments do not. Link additional issues as needed; reviewers verify relevance.

Use the [PR template](PULL_REQUEST_TEMPLATE.md). Fill `## Summary` with what changed and why, and `## Testing` with the checks run, results and remaining limitations; explain relevant checks that were not run or do not apply. These sections and a valid issue reference are required; `## Notes` is optional. An automated check verifies the issue reference; reviewers check the sections.

Keep the change small enough to review coherently. A PR that changes the appearance links its before and after [screenshots](../docs/TESTING.md#ui-screenshots-and-reports), using disposable data. Commit messages describe the concrete change.

An authorized maintainer, or an agent the maintainer designates, reviews each change. Once it is approved, auto-merge squashes it into `main` when its required checks pass: the linked-issue check and **Build and test (all targets)**. The branch need not be up to date with `main`. The push run on `main` is the first run of the combined code and of the targets that pull requests skip; a failure there belongs to the pull request that caused it, and merging stops until it is fixed ([stop the line](../docs/TESTING.md#flakiness-and-races)). A passing check does not authorize a release or establish that behavior outside the check's scope works.

### The pull request watch

The **Watch pull requests** workflow checks every open pull request that targets `main` and is not a draft, after each push to `main`, every 15 minutes and after each **Build and test** run. It reads the repository, runs and checks, writes pull request comments and cancels the runs of conflicting pull requests; it holds no other secret, starts no run, and never approves, merges or turns on auto-merge. Each run's summary lists every open pull request and its finding, or "nothing to do".

A merge to `main` can make an open pull request conflict while its **Build and test** run still tests a revision that has to be merged again, holding runners until it ends. GitHub neither cancels such a run nor reports when a pull request starts to conflict, so the workflow does it. It checks up to four pull requests at a time; a failure with one does not stop the others, and the run then fails, reporting every failure in pull request order. It reads the merge states of all pull requests again every 5 seconds while GitHub is still computing any of them, up to eleven reads in 50 seconds, and reports a state still unknown. When the pull request conflicts, it cancels the queued and running **Build and test** runs of its head commit and comments once for that commit, listing up to 20 conflicting files in a code block; it finds them by merging the head into `main` with `git merge-tree` in its own checkout, one pull request at a time, and comments without them when that fails. Re-running **Build and test** on that commit gets the run cancelled again, without another comment. The comment is never marked cleared, and it stands in for the `conflict` finding on that commit. A pull request that merges cleanly is left alone, and runs of `main` are never cancelled. Cancelling is the reason the workflow's token has `actions: write`; `pull-requests: write` is for its comments.

For each finding below it posts one comment, never twice for the same head commit, and adds a line to that comment when the finding clears or the head commit changes:

| Finding | When it is posted | What the author does |
|---|---|---|
| `no-build` | The head commit has had no **Build and test** run 10 minutes after it was pushed. Events made with the workflow's own token start no pull request runs, so the workflow cannot start one. | Push again, for example an empty commit, or close and reopen the pull request. |
| `conflict` | The pull request has conflicted with `main` for 20 minutes. | Merge or rebase `main`, resolve the conflicts and push. |
| `failed` | A required check failed 30 minutes ago and nothing has been pushed since. | Fix the failure and push. If a known flaky test caused it, comment on its issue and rerun the failed job once. |
| `not-merging` | Every required check passed 15 minutes ago, auto-merge is off, and the pull request has an approving review or had auto-merge on before. | Ask the reviewer to merge it or turn on auto-merge. |

The workflow measures a push by the first check that started on the head commit, or the commit's date when none started; a conflict from the later of that push and the last change to `main`; and a failure or a pass by the completion of the required checks.

### AI-assisted changes

Explain material AI involvement and how you reviewed and verified the result. The contributor remains responsible for correctness, security and licensing. Keep discussion constructive and address findings on their merits.

Credit each AI agent that contributed to the changes included in a commit, using its verified GitHub co-author identity. Include all contributing agents. For example:

```text
Co-authored-by: Claude <noreply@anthropic.com>
Co-authored-by: Codex <noreply@openai.com>
```

Keep the human contributor as the primary author. Preserve all applicable co-author trailers when squashing commits; do not credit an agent merely because it created the commit or opened the PR. The squash commit takes the PR's title and description, and GitHub adds the co-author trailers from the branch's commits. Don't repeat them in the PR description.

## Verification

Use the revision's documented toolchain and commands in their required order. Follow [TESTING.md](../docs/TESTING.md#6-verification-scope) for documentation checks, execution, coverage, disposable fixtures and [evidence](../docs/TESTING.md#8-evidence-and-handoff). Report the tested revision, commands, results, unexplained failures and limitations in the issue/PR; never invent commands or claim unimplemented behavior was tested. The coding standards own test authoring.

## Licensing

Contributions to TeamRun's own code and documentation follow the [MIT License](../LICENSE). Introduce third-party material only when you have the necessary rights and have reviewed its license; preserve required notices and record its source. See the coding standards for dependency, source and generated-file requirements.
