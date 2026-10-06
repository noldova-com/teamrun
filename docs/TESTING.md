# TeamRun testing contract

**Scope:** Test discovery, execution, isolation, result accounting, coverage and verification evidence.

The [coding standards](CODING-STANDARDS.md) own test authoring, placement, API checks and security; the [architecture](ARCHITECTURE.md) owns product boundaries.
[AGENTS.md](../AGENTS.md) owns permissions, including authorization for live external-service checks.

## 1. Ownership and proof boundaries

| Boundary | Responsibility |
|---|---|
| Foundation Testing (`src/foundation/testing`) | Package-test discovery, execution, assertions, structured results, reporting and coverage measurement/enforcement |
| Node.js's built-in test runner | The tests of the repository's scripts under `scripts/tests`, because scripts run before foundation is built. Their coverage is measured after the tests, by Foundation Testing from the build that `npm test` requires: it measures each TypeScript file (`.ts`, `.cts` or `.mts`) under `scripts/` outside `scripts/tests` as Node.js runs it, with its types stripped. Node.js's own coverage merge is not used, because it drops uncovered blocks depending on the order of the processes' reports. A filtered run measures no coverage, so it needs no build |
| Angular test configuration | Component and service execution through Angular's supported testing surface, including framework error propagation and DOM-state isolation. Vitest runs the specs in headless Chromium through Playwright, so styles, layout and computed values are real |
| Playwright desktop UI suite | User workflows through the running Electron application, named screenshot checkpoints, traces and cross-platform results |
| Tests of the owning package | Its domain, protocol, persistence and process behavior through the boundary being verified |
| Structural checks | The architecture's [dependency rules](ARCHITECTURE.md#2-components-and-dependency-direction): what a module may import, that each package imports only what its own manifest declares, and that the shell's production source names no module; and its [identity rules](ARCHITECTURE.md#3-vocabulary-and-identity): that no two complete names are equal; and the [delivery rule](ARCHITECTURE.md#10-build-installation-and-updates) that a packaged build leaves out the kit's Gallery, checked by building the window with `--packaged` and finding none of the Gallery's selectors or text in it, nor code that sets the `data-tr-state` attribute only the Gallery sets |
| Build and verification entry points | Select the source state and scope, prepare the required installed artifacts, invoke the relevant checks and aggregate their outcomes |
| Native installer and update checks | Exercise the packaged application and installation lifecycle on the stated OS and CPU |

Tests own their fixtures.
The package runner neither bootstraps the application, signs in to services nor installs global state.
Angular retains its framework runner; all runners follow this contract.

A build proves that selected sources produced expected outputs; tests prove exercised behavior; coverage measures execution of the declared inventory.
Coverage and byte identity do not prove correctness, external-tool compatibility or native installation acceptance.

## 2. Discovery and selection

Foundation discovery uses explicit package identities, compiled locations, markers and naming rules, never incidental working directories or locations outside the selected scope.

Foundation test identities contain package, relative file, class, method and data-row identity.
Angular/Playwright retain project/file/suite/title identities.
Reject duplicates and omissions.
Foundation discovery and selection are deterministic across locales and filesystem enumeration; malformed declarations, invalid rows and unexpectedly empty test files fail discovery.

A filtered run reports its selection and discovered/selected/unselected counts.
No matches fails; a filtered pass is not the complete gate.
Only packages without executable production code may justify an empty inventory; failed discovery or missing builds are errors.

The package runner's markers are `@TestClass`, `@TestMethod`, `@TestData` (each marker is one data row, run as its own test), `@Category` and `@Skip`.
Its filters are a JSON array of strings in the `TEAMRUN_TEST_FILTERS` variable.
A filter selects a test when it is a substring of the test's package name, file path or class name, or of the test's identity `Class.method[index]`, where `[index]` is the data row's index and absent for a test without rows, or when it is `category:<name>` and a category of the test or its class has exactly that name.
A test is selected when any filter selects it.
A filtered run lists its filters and the discovered, selected and unselected counts in the console and in the GitHub summary, and fails when it selects no test.
When `TEAMRUN_TEST_RESULT_FILE` names a file, the runner writes its result to it as JSON, for the commands that report it: the discovered, selected, passed, failed, skipped and unreached counts, each skipped test's file, name and reason, and the files that ran.
It then leaves a run that selects no test to the command, which decides whether that fails.
When `TEAMRUN_TEST_RESULTS_FILE` names a file, the runner writes to it, as JSON, whether every selected test reached an outcome and each failed test's identity, file and failure, from which `npm test -- --rerun-failed` selects the tests to run again.

`npm test -- --filter <text>` selects tests across the three runners, and may be given more than once.
The package runner takes each filter as above.
The script runner takes it as part of a script test file's path; when any filter is part of such a path, the run is those files, and otherwise each filter is part of a test's name, matched in every file.
The Angular runner takes it as part of a spec file's path, relative to `src/`.
A filtered run runs only these test checks and leaves out their coverage gates, since a selection does not execute the whole inventory.
It lists its filters and, per check, the discovered, selected and unselected counts, of package tests, script test files or spec files, in the console and in the GitHub summary.
A script test file is selected when a test in it matched, and a file that fails to load fails the check.
The package tests fail when the runner discovers no test in them at all.
The run fails when no check selected anything.
`npm test -- --repeat <count>` runs the selection, or the complete gate without filters, that many times in a row.
It stops at the first run that fails and says which one.
`npm test -- --rerun-failed` runs each failed test once more, as [Flakiness and races](#flakiness-and-races) describes; it is made for the complete gate, its parts and a selected run, and with `--filter` only the Angular tests retry.
Pull request and `main` runs pass `--rerun-failed`, with each test job's `--part`, and never `--repeat`; CI repeats tests only in a labelled pull request's [repeated runs](#flakiness-and-races) and in the [nightly run](#ci-levels).
`npm run test:ui` hands its arguments to Playwright, so `npm run test:ui -- <file> --repeat-each <count> --retries 0 --max-failures 1` repeats the workflows of a file on a test machine and stops at the first failure, which Playwright names.

`npm test -- --package <name>` selects the tests of a package by its full name, such as `@noldova/teamrun-foundation-core`, and may be given more than once; `--angular-tests` and `--script-tests` select those runners' tests, and `--checks-only` selects no test.
A selected run runs every check other than the tests in full, and then only the selected tests, each with its coverage gate.
A package's coverage counts the tests of the packages that depend on it, so a selection names those packages too.
A selected run takes no filter and is not the complete gate.
With `--part`, it runs that part's checks with only the selected tests among them, and refuses a selection that has none of the part's tests.
The [verification scope](#6-verification-scope) makes such a selection from a pull request's changes.

Add only capabilities needed by the accepted suite, without a plugin system or second discovery registry.

## 3. Execution, isolation and shutdown

Each foundation method/data row gets a fresh test-class instance; Angular/Playwright use their fixture lifecycles.
Tests establish and release state independently of order.
Observe methods and returned promises to completion.
Failed assertions, throws, rejections and unexpected errors fail the test, or the enclosing run when attribution is impossible.

The execution boundary owns deadlines, cancellation and cleanup.
A test that exceeds its time limit fails, and the run ends after reporting it, so no uncontained work continues; rejecting a wait alone stops nothing.
Forced interruption requires a separately terminable process/worker with descendants and resources accounted for.
Verify that mechanism before claiming it works.

Observe pending and late failures before completion; unassignable errors fail the run.
Crashes, forced termination, cancellation and incomplete cleanup remain explicit unsuccessful/incomplete outcomes.
One-shot commands must terminate with the appropriate status under the coding standards' process-lifetime rules.

Use owned disposable files, repositories, databases and profiles.
Cleanup runs on success, failure and cancellation, touching only fixture resources and preserving diagnostics.
Never mutate real data, profiles, projects, clipboard or desktop as incidental fixture setup.

Scoped mock clocks may exercise long deadlines without changing production defaults.
Code that a mock clock drives calls `timers.setTimeout` through the default import of `node:timers/promises`, because the mock replaces the module's function, not a named import's binding.
Wait for work to start; check before/at the deadline and retain real process/socket cleanup checks.
Use a real-time guard and restore timers on success/failure.
Global mocks require serial execution or process isolation; clock advancement proves neither wall time nor native termination.

Angular tests install a throwing `ErrorHandler` through the unit-test builder's provider configuration.
Unexpected framework errors must fail the run; a test of an expected error asserts it explicitly.
Specs that depend on styles, storage, preferences or document focus establish their own initial state and restore it after pending effects and fixtures are destroyed.
Spec files share a page, so a spec leaves no application, painted appearance or element running or mounted after it.
The real pointer stays wherever a spec file last moved it and sends real boundary events to whatever renders under it, so a spec that dispatches its own pointer enter and leave first moves the real pointer onto a shield over the page, as the tooltip fixture of the window tests does.
Such a shield or pointer park is hovered through the kit tests' pointer fixture, which finds it by a test id: the browser runner otherwise finds a hovered element by its position among all elements of its tag in the document, so an earlier element of that tag that goes away while the hover starts leaves the hover a different element or none to find.
The kit's global stylesheet is part of each spec file's initial state: before each file runs, a setup file waits for the page's stylesheet to finish loading, adds it when the page has none, and fails the file when it does not load or does not finish loading within its limit.
Vitest's browser matchers, such as `expect.element`, arrive through their own script in the page, whose failure to load the runner does not report, so before each file runs, a setup file fails it at once, naming that script, when they are missing.
A passing assertion alongside an unhandled framework error is not a pass.

### Flakiness and races

A test that sometimes fails is a bug in the test or in the code, and no test is flaky by nature.

- **Deterministic tests.**
  A test waits on an event or a condition, never a fixed sleep.
  A limit only bounds a hang: it is generous and is never what the test checks.
  A flaky test is never skipped as the fix, and a passing rerun never counts as one.
- **No races in the code.**
  Code never relies on the order of independent events, such as a process's exit against its message, or a window closing against a save.
  The order is made explicit, for example with a reply or an acknowledgement.
  Each such fix comes with a test that forces the bad order and fails on the old code.
- **Fixed pauses are listed.**
  A test waits for an event or a condition, not for a fixed time.
  A wait that polls is bounded and fails with a message that says what it waited for.
  Node.js tests of packages poll with `Wait.untilAsync` from `@noldova/teamrun-foundation-testing`, which returns whether the condition held, so the caller fails with that message.
  Angular specs poll with Vitest's `vi.waitFor`, and UI workflows with Playwright's `expect.poll` or `toPass`.
  Script tests can't import the packages, so they wait for an event or a promise that the code under test gives.
  Test code pauses for a fixed time only in the files that the table at the end of this section lists, each for its reason.
  In any other test file `npm test` refuses an import from `timers/promises` that names `setTimeout` or `scheduler`, or that is a namespace or default import; `scheduler.wait`; `Atomics.wait` and `Atomics.waitAsync`; a `setTimeout` given a named callback or a written-out delay; a promise that `setTimeout` resolves; and Playwright's `waitForTimeout`.
  It also refuses a listed file that no longer pauses.
- **Flakiness is a bug.**
  A flaky or racy failure seen anywhere, locally or in CI, gets its own bug issue and a small fix PR right away, never folded into other work.
- **One rerun in the same job.**
  Pull request and `main` runs run each failed test once more in the same job.
  `npm test -- --part <part> --rerun-failed` runs the failed package and script tests again and lets Vitest retry a failed Angular test once, and each UI shard runs Playwright with `--retries 1`.
  A test that fails both times fails the job.
  A test that fails and then passes is flaky: it doesn't fail the job, and even when another test does, the job lists it under "Flaky tests" in its summary and writes it, with its runner, file, name and first failure, to `_build/flaky-tests.json`, which each test job and UI shard keeps as its own `flaky-tests-` artifact.
  A flaky test gets its own bug issue in the Shell milestone with a fix due within 24 hours, and merging continues.
  A job that a known flaky test failed both times may run again once, after a comment on its issue, and never a second time.
  A rerun records its coverage into the first run's coverage folder, so the coverage gate measures both runs together and a test that failed before reaching its lines doesn't fail the gate once its rerun passes; Vitest retries in the same process and records every attempt.
  Rerunning only the failed tests can turn a real failure that depends on the order of the tests into a flaky pass; the flaky test record still reports it, and the [nightly run](#ci-levels) never reruns a test.
- **Flaky test issues.**
  After each Build and test run on `main` or for a pull request from this repository, the Flaky tests workflow gathers the run's `flaky-tests-` artifacts and opens or comments on one bug per flaky test, naming every job it was flaky in.
  It finds a test's open bug by the key the bug was opened with, or else by an open bug whose title is exactly `Flaky: ` and the test's full name, never by a name elsewhere in a title or in a body.
  More than ten flaky tests in one run share one issue.
  The issue fences the test's name and first failure, redacted as the runtime redacts its diagnostics.
  The workflow can write only issues, reads the run's artifacts with its own token and never runs for a fork's run.
  Every Monday its summary counts how often each test and each target was flaky in the last seven days.
- **Stop the line.**
  Merging stops only while `main` itself fails, or while a flaky failure blocks merging in practice: it failed both of its runs in two or more pull request runs in a day, or a passing run is rare.
  A stop that lasts longer than an hour is reassessed, and the reason it continues is recorded on its issue.
  A pull request held by a stop doesn't hold its author, who moves to their next task.
- **Repeated runs.**
  A change to startup, shutdown, processes, windows or inter-process messages, a fix for a flaky test, and a new or changed test of processes, timing or platform behavior pass their affected tests five times in CI before they merge.
  The reviewer adds the `repeat` label to such a pull request, and the Repeat workflow runs on its head:
  - It selects, from the change since the merge base, each changed test and UI workflow file, the test that mirrors each changed production file, and every test that imports a changed fixture or other test support file, directly or through another.
    A `Repeat:` line in the pull request's description adds test and UI workflow files by their path from the repository's root, such as the UI workflows a change to the desktop affects.
    The line is read when the label is added and on each push.
  - Linux x64 and Windows x64 each run the selection in five parallel jobs, one pass each, and macOS ARM64 runs the five passes in as few jobs as its time limit allows, since macOS runners are scarce.
    It uses one job unless five passes of the selected UI tests, counted in their files, would take more than about 40 minutes there; then two jobs each run a Playwright shard of them five times, and only the first repeats the selected tests.
    Each job builds and runs the selected tests through `npm test -- --filter` and the selected UI workflows with `--retries 0` and a global timeout that stops them before the job's time limit.
    Each job's summary counts its UI tests and says when they ran out of time, so a stop for time doesn't read as a failing test.
  - The check "Repeat (all targets)" passes at once without the label and in a merge group, and with the label only when every repeat job passed, so a labelled pull request doesn't merge before its repeats.
  - The repeats show that the selection passes five times on each of those targets, and nothing about tests outside it.
    The [nightly run](#ci-levels) also repeats every test and UI workflow five times on every target, which catches what a change's own repeats miss.

| Test file | Why it pauses |
|---|---|
| `scripts/tests/fixtures/repository.fixture.ts` | Between bounded attempts to remove a fixture repository that Windows still holds open. |
| `src/foundation/testing/tests/fixtures/execution/entry-lifetime.fixture.ts` | One fixture test outlasts its time limit on purpose, so the runner's time limit is tested. |
| `src/shell/desktop/tests/e2e/teardown.spec.ts` | Three workflows block the main process on purpose. Two test the harness's handling of a main process that stops answering. The third makes it fail first, so a request's failure is tested to carry the main-process failure the desktop log holds. A fourth leaves work running, so a quit that stops at the question about it is reported as that question, with its window and text, and not as a silent main process. |
| `src/shell/desktop/tests/services/update-barrier-watch.test.ts` | A started watch checks the barrier every millisecond, and the test waits 20 ms once the watch has quit the desktop, and again once it is stopped, so the watch is tested to check no more. |
| `src/shell/runtime/tests/services/client/runtime-launcher.test.ts` | A runtime publishes itself 600 ms after the launcher starts, so the launcher's wait past its own timeout is tested. |
| `src/shell/runtime/tests/services/lifetime/runtime-host.test.ts` | Another holder releases the data directory, or publishes discovery, 200 ms after the runtime starts, so the runtime's wait for either is tested. |
| `src/shell/runtime/tests/services/lifetime/update-preparation.test.ts` | An update's barrier stays unreadable, unparsable, handed off by a process that has exited, or held by one that cannot be looked up, for 200 ms, ten times the interval at which the runtime reads it, so the runtime is tested to keep updating until the barrier is gone. |

## 4. Results and reporting

Assertions compare values according to a documented operation; truthiness or formatted strings must not replace the required value comparison.
Structured assertion failures retain meaningful expected and actual values and their cause, subject to redaction.

Results record stable identities, outcomes, durations and failure/skip details for every test and data row.
Distinguish executed, skipped, unselected and unreached tests; reconcile totals with discovery and selection.
The Angular run expects a result for every file its test target's include patterns match under src/; it refuses a test target that excludes files, since it does not apply exclusions.
Its whole output is also written to `_build/angular-tests.log`, which a failed check names and CI keeps with the JSON report when the test step fails.
Preparing the project and starting the run both remove the test runner's pre-bundled dependencies under `src/node_modules/.vite`: they are keyed by the lockfile alone, so they would otherwise keep an earlier build of TeamRun's own packages.

Console output groups package/file/class results and prints details as each class completes.
Reduced-detail mode hides passing tests and entirely passing classes.
Final totals and GitHub summaries cover the whole run.

All reports derive from structured results; machine consumers never parse console text.
Preserve failures, skip reasons, incomplete coverage and totals at every detail level.

Each test runner of `npm test` records its totals in `_build/totals/<runner>.json`, a versioned record of its discovered, executed, passed, failed, skipped, unselected and unreached counts, each skipped test with its reason, the files that ran, the files it should have run, the coverage it measured, the duplicate identities and empty files it found, how many of its failed tests passed when run again and, for a UI shard, which shard it was.
The package runner's totals come from its result file and from the count of fully covered files, out of those its gate measures, that foundation's coverage run writes to the file `TEAMRUN_COVERAGE_RESULT_FILE` names; the script tests' from `scripts/totals/script-test-reporter.ts`, a reporter of Node's test runner, and the same coverage count; the Angular tests' from Vitest's JSON report and the statements in its coverage summary under `_build/angular-coverage`.
Vitest's report keeps no skip reason.
A test is identified by its file and then each name it is nested under, outermost first; every runner's totals name tests that way.
A complete or part run clears the records first, then prints each runner's totals and adds them to the GitHub summary as a table with the skipped tests listed.
A runner whose counts do not add up to what it discovered, or whose skipped tests do not match its count, fails its check, and so does one that leaves no readable result.
The totals record each test's outcome in its first run: a test that passed only when run again still counts as failed, and the flaky record names it.
The record keeps how many of those tests passed when run again, and the printed totals and the summary table say it beside the runner's failed count.
A runner's check also fails, naming them, when two of its tests have the same identity, when a file it ran has no test, or when a file it should have run has no result.
The script tests should run every file `scripts/tests/**/*.test.ts` matches, and the Angular tests every spec file they selected, or all that their test target includes.
Node's test runner passes a file without tests, which the script totals report as empty; Vitest fails one, which the Angular totals count as one failed test.
Each UI shard's summary, `scripts/ui-summary.ts`, records the shard's totals in `_build/totals/ui.json` from its Playwright JSON report and from one `--list` of every workflow, without the shard or grep: the list gives the discovered tests, and those the shard didn't select are unselected.
The files it should have run are every listed file or, for a shard of a `--grep` run, the files a second list with the grep names.
A shard doesn't fail for a file that only another shard ran; the run's test totals check its shards together.
A UI test counts by its first result.
A test whose expected status is skipped is skipped, with its skip annotation's reason.
A test with no result, or one cut off by an interruption or the global timeout, is unreached, and one that passed only when retried is failed.
Playwright leaves a spec file without tests out of its list and still passes the run, so the summary compares the list with the files that the config's `testDir`, `testMatch` and `testIgnore` match, and fails on a matched file without tests.
The nightly and repeat runs don't summarize their shards this way.

The gate fails on setup, discovery, execution, cleanup, coverage or reporting failure, or any missing/interrupted required result.
Skips remain visible with declared reasons and never waive required behavior or coverage; exceptions explicitly name their scope.
Never convert failures into skips or use hidden exclusions.

## 5. Coverage requirements

The coverage and configuration requirements are:

| Scope | Requirement |
|---|---|
| Foundation packages, including Testing itself, plus the shell's `protocol` and `cli` | 100% of executable production code; CLI verification includes arguments, failure paths and process exit |
| `src/shell/runtime` | 100% of executable production code, except `services/process/windows-process-api.ts`, which loads the Windows addon that reads the process table and ends processes; it runs only on Windows, where the process tests drive it and the addon natively. Package tests drive the Windows process table and ending through a fake of its interface. The package's manifest declares that exclusion with its reason under `teamrun.coverageExclusions`. No coverage is measured for the addon's C source |
| Repository-owned executable automation, including build, test, packaging and release logic | 100% executable-code coverage, with behavior and process-boundary checks appropriate to the operation |
| YAML and other non-executable configuration | Applicable schema/configuration validation and workflow checks; no executable-code coverage percentage |
| A module's `protocol`, `runtime` and `cli` | 100% of executable production code. Where a part drives an external tool, doubles cover parsing, routing and lifecycle; behavior only the real tool can exercise needs separately authorized live verification and explicit accounting of uncovered lines |
| Angular parts: the shell's `window` and `ui`, and a module's `window` | 100% of executable production code through component and service tests on the framework's testing surface, measured with Vitest's V8 coverage through the Angular unit-test builder, whose threshold fails `npm test` like the other coverage gates, plus the desktop UI workflow gate in section 6. Enum files hold no executable code after the build, which inlines their members, and are left out of the measurement. The compiler also emits, after each class, a call that records the class's decorator metadata for development tools, `(() => { (typeof ngDevMode === "undefined" \|\| ngDevMode) && i0.ɵsetClassMetadata(…) })()`. It is compiler-generated, runs only in development mode and never in production, and the functions in its copy of the decorator arguments never run. `scripts/angular/class-metadata-coverage.ts` marks exactly that call for the coverage to skip, and the run reports how many it skipped; besides the enum files, it is the only Angular-side exclusion |
| `src/shell/desktop` | 100% of executable production code through package tests that drive it with fakes of Electron's main-process and preload APIs, except `main.ts`, which composes the desktop from Electron's own modules, and `utility-entry.ts`, which connects the detached start to the parent port of an Electron utility process; both run only inside Electron. The package's manifest declares those two exclusions with their reasons under `teamrun.coverageExclusions`, and the package coverage check reports each file and reason. Application launch is verified by the desktop UI workflow gate in section 6, and the Windows start test runs `utility-entry.ts` |

Define additional packages' coverage and scope before claiming a complete gate.
Non-executable definitions need no artificial tests; other exclusions are explicit, justified and reported, including behavior requiring live services.
A package declares a file its tests cannot run in its manifest's `teamrun.coverageExclusions`, each entry naming the source file and the reason; the check reports each excluded file with its reason, still measures it, and fails for an exclusion that names no file of the package.
Only this table grants an exclusion: the Coverage exclusions check refuses one unless a row whose scope is the package's folder, in code format, names the file in code format, and it fails when it cannot read the table.
Executable scripts retain their coverage obligations.
Inline workflow scripts stay small and carry no coverage percentage; their tests run the exact text from the workflow against doubles of the tools it calls.

The test mirror check in `npm test` enforces the mirror rule of [CODING-STANDARDS.md](CODING-STANDARDS.md#13-tests).
It decides whether a file has a function body by erasing the file's types with Node.js's `module.stripTypeScriptTypes` and scanning what remains.
That API is experimental in Node.js 26 and prints one `ExperimentalWarning` per process.
Its two callers are `scripts/structure/type-stripper.ts`, for the check, and Testing's `file-coverage-analyzer.ts`, which maps coverage of TypeScript files to their lines.
Strip-only mode refuses an enum, which the check then scans as written; a missing API or any other refusal fails the check instead of passing it.
Before moving to Node.js 27, confirm the API keeps its name, its strip-only mode and its refusal code and message, or replace both callers together.

Unmeasurable bootstrap work is incomplete verification, not a coverage exception.
Record the files, missing capability and actual checks in the issue/PR; close the gap before claiming a complete pass.

Measure the complete executable inventory, including unloaded files as uncovered.
Missing coverage, invalid ranges, malformed reports or unusable required source maps fail analysis; they never reduce its denominator.
Keep paths and package identities unambiguous across operating systems and installations.

The Node-bootstrap adapter uses the selected runtime's coverage and build source maps; verify their formats/mapping against the pinned toolchain.
Source changes require fresh artifacts and matching maps.
Source/package drift invalidates results.

Report covered/executable file counts and percentages against the tested source identity.
Raw block totals are run diagnostics, not revision fingerprints; retain discrepancies rather than rewriting earlier observations.

## 6. Verification scope

Documentation changes require content, consistency, link and formatting checks.
Verified commands and prerequisites belong in README or the owning tooling guide when available; do not invent commands for missing tooling.

A PR's run skips the code build/test matrix only when every changed path is Markdown at the root, under `docs/` or under `.github/`, or a module's own `src/modules/<id>/README.md`.
It builds and tests but skips the UI workflows when every changed path is that documentation or lies outside what the app is built and its UI workflows run from: CI and repository configuration under `.github/` and `.gitignore`, and the script tooling that neither builds nor runs the UI workflows, which `scripts/workflows/change-classifier.ts` lists.
The workflows that define the UI jobs and the setup they share, under `.github/actions/`, are not in that list, and a script test fails when a script that `scripts/build.ts` or `scripts/ui-workflows.ts` imports is.
All other changes, including another package's README, require the full matrix.
Check both rename paths and compare from the PR's merge base.
A merge group is classified the same way, comparing the queued changes with the `main` the group was built on.
Pushes to `main`, empty comparisons, unavailable history and manual runs select everything.

The classification also selects the tests a pull request's changes can affect, which `scripts/workflows/change-selector.ts` decides and the run's summary states.
A changed package selects its own tests and those of every package that depends on it.
The window and the kit count as depending on the packages they import, which the selector lists and a script test compares with their imports.
A change to a package's source, to the window or the kit, or to the UI workflows' harness or fixtures selects every UI workflow; a change confined to a package's or the window's tests selects none, and a changed UI workflow selects itself.
The window, the kit and the packages they depend on select the Angular tests, and the script tooling outside the app selects the script tests.
Every other check always runs.
The selection is everything when a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration changes; when `npm test`'s own scripts, the foundation's test framework, the tooling the app is built or its UI workflows are run with, or any other path changes; and when the packages cannot be read.
Merge groups, pushes to `main` and manual runs are never narrowed, so a pull request's green narrowed run proves only what it selected, and the merge group runs its level in full before anything merges.

The aggregate check reports documentation-only and UI-free scopes and fails on classification failure or any failed, cancelled or unexpectedly skipped required job.
Each target builds and tests through its own call of `.github/workflows/build-and-test-target.yml`, which runs the jobs the classification plans for it.
`scripts/workflows/build-matrix.ts` says which targets split their tests.
The Linux and Windows targets do: a build job runs `npm run build` and passes the build, as an artifact of the same run, to three parallel jobs, each running one part of `npm test` with `--part`: `packages` runs the package tests and their coverage, `scripts` the script tests and their coverage, and `angular-and-checks` the Angular tests and their coverage and every other check, after an `npm run build` that reuses the packages it received and installs the Angular tests' browser.
`npm test -- --part <part>` runs one part on its own, also with `--repeat` or `--rerun-failed`; it takes no `--filter`, and only all three parts together are the complete gate.
The parts are chosen from measured times so that no part's job takes much more than about three minutes; the PR that changes them records those times.
The macOS targets build and run all of `npm test` in one job, because the organization runs at most five macOS jobs at a time, and split tests would let one pull request's run take all five.
The target's call also runs its UI workflows in parallel shards, by calling `.github/workflows/ui-workflows.yml`, so a target's parts and shards wait only for that target's build.
When a target splits its tests and its shards reuse a build, its one build job also makes the test build and its variants with `npm run test:ui -- --list`, after `npm run build`, and passes them in the same artifact to the test parts and the shards; the Angular part's own `npm run build` rebuilds the window that the test build replaced.
Any other target with shards makes their builds in a build job of the UI workflows and passes them, as an artifact of the same run, to the target's shard jobs.
Each shard runs its part with Playwright's `--shard` and `--require-current`, which fails the shard instead of rebuilding when the builds it received are not current.
A target whose pull request level is the smoke set has no build job: its one job builds and runs `--grep @smoke` itself.
The classification plans each target's build and shards, and `scripts/workflows/build-matrix.ts` says which targets run the smoke set on a pull request and which leave their UI workflows to manual and nightly runs on a push to `main`.
Each target's shard count is set in `scripts/workflows/build-matrix.ts`, chosen from measured times so that no shard takes much more than about three minutes, setup included; the PR that changes one records those times.
A PR's own runs, and a merge group's, build and test Linux x64, Linux ARM64, Windows x64 and macOS ARM64, each running every test once and the UI workflows its [level](#ci-levels) selects.
Windows ARM64 and macOS x64, whose runners are the slowest and scarcest, are not built or tested on a PR's own runs or in a merge group, which count them as expected skips and name them in the run's summary; they build and test on every push to `main`, where Windows ARM64 also runs every UI workflow, and run in full in manual runs.
A push to `main` is the first run of the targets and UI workflows PRs and merge groups skip; a failure there belongs to the PR that caused it and stops merging until it is fixed.
PR-description/issue validation still runs.
Each test job and UI shard whose tests ran keeps its totals records as an artifact of the run, named by its target and part or shard.
After every target finishes, the **Test totals** job, `scripts/run-totals.ts`, reads the classification's targets and their records, and writes to the summary a table of each target's runners, with its UI shards combined, and a table of the whole run's runners added up.
It checks that every planned test job and shard left a record, that a target's shards listed the same tests, that together they ran a test in every file they should have run, and that no shard found a spec file without tests.
When every target passed, each problem fails the job and with it the aggregate check; when a target failed, it only lists them.
It doesn't run in a cancelled or documentation-only run.

Every run builds and tests in full and reuses no earlier run's result; only a target's test parts and UI shards share that target's build from the same run.
A push to `main` always builds and tests every target and runs every UI workflow on every target but macOS x64.
Packaging runs by hand and each night, as [CI levels](#ci-levels) describes, never on a pull request or a push; a release runs only by hand, through the [Release workflow](ARCHITECTURE.md#publication), which builds, tests and packages every target again.

Build, pack and install the selected source before testing its package API; dependencies must resolve to those fresh artifacts.
Use targeted checks during development.
CI is the gate: the complete gate, the UI workflows and the repeats [Flakiness and races](#flakiness-and-races) requires run on the pushed head, and green required checks at the pull request's head are the evidence.
Repeat successful checks locally only after a change, failure or unresolved concern.

Before pushing for review:

- Run the tests of what the change touches, natively on Linux, and the UI workflows it affects.
  A change that does not touch the UI skips the workflows.
- Check a configuration change, such as a workflow, with the tool that reads it.

The complete gate, the other UI workflows and the repeats are not run locally before review.
A full run on a machine is for debugging a failure and for the native checks CI can't cover: elevated Windows, the real cursor, OS notifications, macOS-only behavior, and reproducing a CI failure.
CI's run on every target is the evidence for "natively on Windows, Linux and macOS"; link it.
Name each machine's OS and CPU in the report of a native run.

Name additional evidence according to the claim:

- Fixtures verify an adapter's inputs, outputs and lifecycle.
  They do not prove that the real external tool applies supplied instructions or supports a control.
- Protocol and persistence changes need the relevant serialization, compatibility, migration, interruption and recovery checks through their owning boundaries.
- Angular specs verify component behavior.
  Native-window evidence is needed for claims involving Electron, OS integration or actual desktop interaction.
- Packaging or cross-compilation does not establish execution on a target.
  Installer and update claims require the corresponding native checks under the architecture's delivery contract, including existing data and install scope where relevant.

Ordinary checks use fixtures without sign-in to an external service or paid use.
Separately authorized live checks record the actual service, tool version, observed settings and scope; missing observations remain unknown.

Performance claims require representative workloads, recorded conditions and repeated measurements outside coverage.
Check scaling separately; ordinary unit tests impose no machine-dependent speed thresholds.
Missing measurements remain unknown; speed alone proves neither allocation nor retention improvements.

### CI levels

CI runs the tests and checks in full on every run, and the UI workflows at these levels:

- **Pull requests and merge groups:** every UI workflow on Linux x64 and Linux ARM64, in their shards, and only the smoke set on Windows x64 and macOS ARM64, each in one job that makes its own test build and runs the set, with no separate build job or artifact.
- **Every push to `main`:** every UI workflow on every target but macOS x64, which builds and tests and leaves its UI workflows to manual and nightly runs.
  The organization runs at most five macOS jobs at a time, and the UI shards of both macOS targets would make every merge wait for them.
- **Manual runs:** every UI workflow on every target, macOS x64 included.
  This is the run to start by hand before a release.
- **Nightly:** the Nightly repeats workflow runs every test and UI workflow five times on every target, without retries, each night and on request; a failing run of the tests does not stop the next one.
  It is the one place CI repeats every test.
  It also packages Windows x64 and Linux x64 once, through the Package workflow below.
  A UI workflows job records each workflow that failed.
  A tests job records each check that failed, such as the package tests, with the failing tests the check's part of the log names, so unrelated tests of one check share its record and its issue.
  A job that left no result fails as a whole.
  Each failure comments on the open `bug` issue the nightly run opened with the title "Nightly: " and the failing workflow or check, or opens that issue, and links the run.
  More than ten failures in one night go the same way to one issue titled "Nightly: more than ten failures".
  A night without failures posts nothing.
  When a request to GitHub fails, the report stops, names what it had already filed and fails the run.

The Package workflow makes the packages of a target with `npm run package` and checks them with `npm run package:smoke`.
The smoke check installs or unpacks the package, starts the desktop with a fresh data directory, waits for `teamrun status` from the installed program to report the packaged build's runtime, quits the desktop and requires it to exit cleanly.
On Linux it also requires that the runtime still holds its own copy of the AppImage after the desktop quit, and that the copy ends with the runtime.
The Linux job runs the check twice: with the AppImage mounted, and with `APPIMAGE_EXTRACT_AND_RUN=1`, where the copy is an extraction.
It reports how long the install took, and a Windows installer that does not finish in time fails with the files it had installed by then.
The Windows installer runs with Windows PowerShell's own module folder first in `PSModulePath`, so the Windows PowerShell it starts to check for a running TeamRun finds its cmdlets before searching other modules; the hosted Windows ARM64 runner lists its large set of preinstalled modules first, and each of those checks then took more than a minute.
After a Windows install it requires `TeamRun.exe` and every DLL of the packaged Electron in the install folder.
It also requires `bin\teamrun.cmd`, with its folder once in the user's `Path`, and runs every `teamrun status` through that command from `cmd.exe`, plus one from PowerShell once the runtime answers.
Once the runtime has stopped, it installs again over the install and requires the entry still once.
It then uninstalls silently and requires the install folder emptied and the user's `Path` as it was before the install.
On macOS, once the runtime answers, it links the bundle's `Contents/Resources/bin/teamrun` from its own folder and requires that link's `teamrun status` to report the runtime as well.
A run by hand packages every target, macOS included, and keeps the packages as artifacts for two weeks.
The nightly run calls it for Windows x64 and Linux x64 only, keeps those packages three days and reports a failure to make or start the package like its other jobs, in the issue "Nightly: packaging <target>".
A package that was made and started but could not be kept fails the job without an issue, since the product did not fail.
The Linux jobs run on Ubuntu 24.04 with libfuse2 removed, as a stock Ubuntu leaves it out, and with unprivileged user namespaces restricted as the runner ships them, so the AppImage starts as it does on a person's machine.
ARM64 packages are proven only on these runners.

The smoke set is the UI workflows whose titles end with the tag `@smoke`, which Playwright selects with `--grep @smoke`.
It covers the areas most likely to break on one system and not another: start and window restore, docking and document groups, quitting and its question, Settings, command search, native and inline menus, and the programs modules run.
It holds 15 to 20 workflows, each the main check of its area.
A new workflow joins it only when it becomes the main check of one of those areas, or of a new area that depends on the system in the same way, and then replaces the workflow it supersedes, so the set stays within 20; every other workflow runs in manual runs and every night on every target, and on `main` on every target but macOS x64.

### Desktop UI automation

Required Playwright workflows drive the actual Electron window, preload and runtime using generated data and service fixtures.
They complement package/Angular tests; a browser page with a mocked bridge is insufficient.
[UI-STANDARDS.md](UI-STANDARDS.md) owns appearance, behavior and accessibility.

Every user workflow is an end-to-end test of the real application and runs natively on every target in the architecture's [delivery matrix](ARCHITECTURE.md#10-build-installation-and-updates).
CI runs the complete UI suite on all of them in manual runs and every night, and on all but macOS x64 on every push to `main`, each target's in parallel shards, as [CI levels](#ci-levels) sets out.

Use one shared suite with explicit platform-specific launch, path, keyboard and display behavior.
Record OS, CPU, runner image/environment, application revision, Playwright, Electron and host Node versions; distinguish Electron's embedded Node.
Cross-compilation, emulation and another architecture's pass do not certify a native target.
Section 4's gate rules apply to every required target; targeted runs establish only their scope.

Pin the test dependencies when tooling is introduced.
Verify the exact Playwright/Electron combination and its application configuration on each target before relying on it, and repeat the relevant compatibility checks when those dependencies or runner images change.
The test host must supply the required native libraries and a working display; Linux CI may use Xvfb.
Linux UI workflows run with a session bus of their own (`dbus-run-session`), as on a Linux desktop, so the programs the desktop starts on that bus run during them.
A local WSL graphical-session pass is not a GitHub-hosted VM or Xvfb witness.

Keep the application's sandbox, context isolation, web security and content security policy intact.
Inspect packaging and debugger/fuse requirements explicitly; do not weaken a production binary merely to let automation attach.
If an automation-specific launch configuration or test build is required, record its differences and retain separate acceptance checks for the actual distributed binary.
The shared suite launches with GPU acceleration and software GL turned off, so WebGL is unavailable; drawing with WebGL needs its own check in the application with GPU acceleration.
Native OS dialogs, clipboard integration, installers and updates need their own applicable checks; substituting a fixture for one of those operations does not verify the OS behavior.

The shell's workflows cover starting with no module, docking and arranging tabs, layout restoration, Settings transitions, commands and shortcuts, quitting while work is in progress, and relevant focus, keyboard and popup behavior; they exercise contributions through fixture modules that exist only for tests, live in the `fixtures` beside the workflows and enter only a test build's module list under the [architecture](ARCHITECTURE.md#2-components-and-dependency-direction).
`npm run build -- --test` makes that build, and `--without <module id>` leaves a module out of it, so a workflow can start the application without one.
The workflows run on the test build.
One that needs other modules starts on a variant that `npm run build -- --test --without <module id> --output _build/variants/<name>` builds.
`npm run test:ui` builds the test build and every variant itself, the test build last, and skips the builds while the repository files, the declarations and the built outputs are unchanged, so no command lists them; a workflow that needs a new variant adds it to the builds and to the output folders whose changes make the script rebuild, both in `scripts/ui-workflows.ts`.
It then prepares the development app, so the workflows start TeamRun from it under the [architecture](ARCHITECTURE.md#build-inputs).
The harness swaps the variant's window and declarations into `_build` before starting TeamRun and restores them once its runtime has exited, and the workflows run one at a time, so swaps never overlap.
Each module adds the workflows of its own capabilities, run in the application with the modules it depends on.
Extend them when an accepted UI capability adds a distinct user workflow.
Assert meaningful application results, not merely that a click succeeded.
Assert the sizes, spacing, colors and contrast the UI standards specify from computed styles in the running application, on every target.
Use stable accessible roles and names where possible, and locate an element within the view that shows it, so an element of the view being replaced cannot match before the window renders the change.
Wait for observable state rather than arbitrary sleeps, and collect unexpected main-process, preload and renderer failures as part of the result.

A workflow breaks the desktop's connection to a runtime that stays running through `DesktopApplicationFixture.breakRuntimeConnectionAsync`, or makes that connection receive a frame that is not a message through `receiveInvalidFrameAsync`, which emits it as data the socket received, with no hook in the application.
Both methods use Node's undocumented `process._getActiveHandles()` on purpose.
They identify the connection through the sockets' public properties only.
Where the runtime listens on TCP, they match the remote address 127.0.0.1 and the runtime's port.
On a Unix socket, where Node keeps no path, they take the one socket that has no remote address, is readable and writable, and isn't stdin, stdout or stderr.
Each fails, listing every socket it found, unless exactly one matches, so a change in Node or Electron fails visibly.

Verify normal closure, interruption and failure cleanup, including child processes, under section 3's isolation rules.
Disable retries for qualification; diagnostic retries preserve failures and do not turn flaky behavior into an unqualified pass.

### UI screenshots and reports

Each workflow captures named screenshot checkpoints on every target and attaches relevant page/component captures to their test/step, including passing runs, keeping them with the run.
Every workflow file that opens the application takes at least one named checkpoint at its main state, and each name is used in one place only; a harness test checks both.
Beside its image, each checkpoint records what the image was taken with, as a `checkpoint` annotation: the appearance settings in effect, read with `shell.settings` (theme, mode, interface and code fonts, and panel, message and code sizes), the mode the page shows, the zoom, the CSS viewport and the device pixel ratio.
When the settings can't be read, or have no answer within five seconds, the record says why in their place.
Each workflow also keeps its run's environment record.
Each shard's summary lists its checkpoints with these values in a collapsed table.
On failure, retain a trace and capture any usable window.
The console prints a failed workflow's error as soon as the workflow ends, not only at the end of the run, so a run stopped by a time limit keeps the errors of the failures before it.
A failure while starting the application keeps the same evidence: the trace, each window's page and screenshot, each window's visibility, address, loading and crash state from the main process, and the data directory's logs, before the harness closes the application, removes its folders and reports the original failure.
The harness waits for the runtime as the [launcher](ARCHITECTURE.md#launching-the-runtime) does: 20 seconds, and up to 60 while a runtime holds the data directory, failing at once when the window says TeamRun could not start.
Its failure states what the window showed, when the data directory's lock was held, the processes whose command lines name the data directory, and the processor load for each second of the wait.
Each capture has a deadline.
So does each request the harness makes to the main process: one that goes unanswered fails with the request; the last of the harness's own requests that the main process answered, and how many milliseconds before or after the unanswered one was asked (a workflow's own calls are not counted); each main-process failure the desktop log holds, with its stack, or that it holds none, or that it could not be read, giving only the error's code; and the cursor, window and display positions from the last move off the cursor.
The harness then asks that main process nothing more, keeps a report of the silence and a list of the process's threads with the logs, pages and trace, and kills it by the id it reported for itself, naming the process and the request in the failure.
The report gives the request, the process's processor time then and at the report, and whether the window's own request to the main process is answered within 10 seconds; it has 20 seconds, so that wait cannot cut it off.
The thread list is a three-second `sample` on macOS, each thread's state, wait reason and processor time on Windows, and `ps -L` on Linux; its command is stopped after 15 seconds and the list has 20, and a command that fails leaves its own output instead.
The page is reached through the main process, so when the report's request has no answer, the page's screenshot and markup are not waited for.
Report a capture or cleanup failure beside the original failure, never in its place: a cleanup failure is attached to the test as `cleanup-failure.txt`.
A cleanup step that fails does not stop the later ones: the harness still closes the application, stops the runtime and removes the folder, keeping it only while a process TeamRun started still runs, and reports every failure.
Playwright starts Electron with its hang monitor disabled, so the workflows cannot see a page stop responding; package tests cover that path, and a workflow that stops a page ends its renderer process itself rather than asking Electron to crash it, which some targets do not do reliably.

Capture established UI state using declared animation policy and framework stabilization; generic waits must not misread animation cancellation as failure.
Test animations explicitly when relevant.
Record platform, viewport, scale, theme, mode and font settings.

The shared desktop UI suite uses a 1920 × 1080 renderer viewport at one device pixel per CSS pixel at normal zoom.
Captures remain 1920 × 1080 pixels during zoom tests; the recorded CSS viewport and pixel ratio reflect the zoom.
A harness test checks that a checkpoint at 200% zoom shows the whole window in 1920 × 1080 pixels, and that the layout checks the zoom workflows use report a control cut off, outside the window, covered or under 24 × 24 CSS pixels without the spacing that UI-STANDARDS allows instead, a region that scrolls sideways or shows no control, readable text cut off without an ellipsis or at the bottom, and focus out of view.
Verify the actual viewport and PNG dimensions so host display defaults cannot silently reduce the evidence resolution.

The harness applies this viewport to every workflow after each start of the application; a workflow that needs another size asks the harness for it, which keeps that size after a restart.
Chromium sends pointer events at the real cursor's position while that cursor lies inside the window, independently of the test's virtual mouse.
So with the viewport, the harness moves the window just far enough that the real cursor lies outside it, again after each start.
Moving the window sends the page no pointer event, so the harness then sends the window a pointer leave, as the system does when a pointer leaves it, and waits until the page reports no hovered element.
A workflow that ends off its viewport or with the real cursor back inside the window fails.
A workflow that tests the window's own size or position opts out of both by name, with the `desktopWindowPlacement` option, and is checked for neither.

Screenshots are review evidence only.
They are not compared pixel by pixel, and there are no screenshot baselines; behavior, computed-style, contrast and accessibility checks prove the UI.
A PR that changes the appearance links its before and after screenshots.

CI reports expose identities, steps, outcomes, screenshots and traces under an explicit artifact-retention policy.
Uploading them is review evidence, not verification: a failed upload is tried three times with a pause, and when it still fails the job warns and, if the checks and workflows passed, stays green; the summary says when the screenshot link is missing because its upload failed.
Every attempt overwrites an artifact of the same name.
The UI workflow results, the Angular test output, the flaky test records and the nightly run's failures carry the run attempt in their names, so a job that runs again keeps its own evidence beside the failed attempt's, never in its place.
The build a target's test parts and shards fetch, the nightly results and the main window screenshot keep one name, and a job that runs again replaces them.
Failed tests still fail the job.
Downloading a tool the job needs, such as Node.js, Electron's binary or the Angular tests' browser, is retried a bounded number of times with a pause, so a brief network failure doesn't fail the job; a download that keeps failing does.
Preserve startup, execution, capture and cleanup failures.
Section 8 governs committed evidence; results apply only to the recorded build/environment.

GitHub summaries include UI outcomes, duration and bounded failure details beside package results, with complete totals.
Link a separate main-window PNG per target for browser viewing; retain downloadable HTML reports and traces without separate hosting.

## 7. Verification of the testing infrastructure

Before relying on the package runner or a changed reporting path, use controlled negative fixtures through its real entry point.
Verify assertion failures, throws, rejected promises, timeouts, unexpected late errors, malformed discovery, declared skips and incomplete results.
The outer test asserts their expected failure classifications without allowing the deliberately failing child to appear as a successful product test run.

Coverage checks must demonstrate that an unloaded executable file, a genuine uncovered branch and malformed required coverage data cannot produce a complete result.
Aggregation checks must demonstrate that a failing prerequisite, cancelled process or missing report cannot produce a green summary.
Verify process exit as well as the reported failure; a printed error is not evidence that the runner stopped.

## 8. Evidence and handoff

Record scope, revision/snapshot, toolchain, platform, commands, outcomes and limits in the issue/PR, linking CI and selected redacted artifacts.
Evidence creates neither a second progress document nor a product-contract amendment.

Retain each attempt's stdout/stderr separately under the retention policy.
Keep redacted reproduction steps and relevant assertion/stack details in the issue/PR after artifacts expire; link full logs, screenshots and traces.
A passing rerun does not erase unexplained failure.

Commit only reviewed evidence with lasting regression/reference value, such as fixtures; keep routine logs out of source control.
All evidence follows the coding standards' redaction rules.

If a required check could not run, state the missing claim plainly.
Old evidence, a copied package, user-reported success or a fixture-only run must not be presented as newly verified implementation.
