# TeamRun testing contract

**Scope:** Test discovery, execution, isolation, result accounting, coverage and verification evidence.

The [coding standards](CODING-STANDARDS.md) own test authoring, placement, API checks and security; the [architecture](ARCHITECTURE.md) owns product boundaries. [AGENTS.md](../AGENTS.md) owns permissions, including authorization for live external-service checks.

## 1. Ownership and proof boundaries

| Boundary | Responsibility |
|---|---|
| Foundation Testing (`src/foundation/testing`) | Package-test discovery, execution, assertions, structured results, reporting and coverage measurement/enforcement |
| Angular test configuration | Component and service execution through Angular's supported testing surface, including framework error propagation and DOM-state isolation |
| Playwright desktop UI suite | User workflows through the running Electron application, named screenshot checkpoints, traces and cross-platform results |
| Tests of the owning package | Its domain, protocol, persistence and process behavior through the boundary being verified |
| Structural checks | The architecture's [dependency rules](ARCHITECTURE.md#2-components-and-dependency-direction): what a module may import, and that the shell's production source names no module; and its [identity rules](ARCHITECTURE.md#3-vocabulary-and-identity): that no two complete names are equal |
| Build and verification entry points | Select the source state and scope, prepare the required installed artifacts, invoke the relevant checks and aggregate their outcomes |
| Native installer and update checks | Exercise the packaged application and installation lifecycle on the stated OS and CPU |

Tests own their fixtures. The package runner neither bootstraps the application, signs in to services nor installs global state. Angular retains its framework runner; all runners follow this contract.

A build proves that selected sources produced expected outputs; tests prove exercised behavior; coverage measures execution of the declared inventory. Coverage and byte identity do not prove correctness, external-tool compatibility or native installation acceptance.

## 2. Discovery and selection

Foundation discovery uses explicit package identities, compiled locations, markers and naming rules, never incidental working directories or locations outside the selected scope.

Foundation test identities contain package, relative file, class, method and data-row identity. Angular/Playwright retain project/file/suite/title identities. Reject duplicates and omissions. Foundation discovery and selection are deterministic across locales and filesystem enumeration; malformed declarations, invalid rows and unexpectedly empty test files fail discovery.

A filtered run reports its selection and discovered/selected/unselected counts. No matches fails; a filtered pass is not the complete gate. Only packages without executable production code may justify an empty inventory; failed discovery or missing builds are errors.

Document markers, data-row rules and filters as public runner contracts. Add only capabilities needed by the accepted suite, without a plugin system or second discovery registry.

## 3. Execution, isolation and shutdown

Each foundation method/data row gets a fresh test-class instance; Angular/Playwright use their fixture lifecycles. Tests establish and release state independently of order. Observe methods and returned promises to completion. Failed assertions, throws, rejections and unexpected errors fail the test, or the enclosing run when attribution is impossible.

The execution boundary owns deadlines, cancellation and cleanup. A timeout fails the test and stops or contains its work; rejecting a wait alone does neither. Forced interruption requires a separately terminable process/worker with descendants and resources accounted for. Verify that isolation mechanism before claiming it works; uncontained timed-out work invalidates subsequent isolation/success claims.

Observe pending and late failures before completion; unassignable errors fail the run. Crashes, forced termination, cancellation and incomplete cleanup remain explicit unsuccessful/incomplete outcomes. One-shot commands must terminate with the appropriate status under the coding standards' process-lifetime rules.

Use owned disposable files, repositories, databases and profiles. Cleanup runs on success, failure and cancellation, touching only fixture resources and preserving diagnostics. Never mutate real data, profiles, projects, clipboard or desktop as incidental fixture setup.

Scoped mock clocks may exercise long deadlines without changing production defaults. Wait for work to start; check before/at the deadline and retain real process/socket cleanup checks. Use a real-time guard and restore timers on success/failure. Global mocks require serial execution or process isolation; clock advancement proves neither wall time nor native termination.

Angular tests install a throwing `ErrorHandler` through the unit-test builder's provider configuration. Unexpected framework errors must fail the run; a test of an expected error asserts it explicitly. Specs that depend on styles, storage, preferences or document focus establish their own initial state and restore it after pending effects and fixtures are destroyed. A passing assertion alongside an unhandled framework error is not a pass.

## 4. Results and reporting

Assertions compare values according to a documented operation; truthiness or formatted strings must not replace the required value comparison. Structured assertion failures retain meaningful expected and actual values and their cause, subject to redaction.

Results record stable identities, outcomes, durations and failure/skip details for every test and data row. Distinguish executed, skipped, unselected and unreached tests; reconcile totals with discovery and selection.

Console output groups package/file/class results and prints details as each class completes. Reduced-detail mode hides passing tests and entirely passing classes. Final totals and GitHub summaries cover the whole run.

All reports derive from structured results; machine consumers never parse console text. Preserve failures, skip reasons, incomplete coverage and totals at every detail level.

The gate fails on setup, discovery, execution, cleanup, coverage or reporting failure, or any missing/interrupted required result. Skips remain visible with declared reasons and never waive required behavior or coverage; exceptions explicitly name their scope. Never convert failures into skips or use hidden exclusions.

## 5. Coverage requirements

The coverage and configuration requirements are:

| Scope | Requirement |
|---|---|
| Foundation packages, including Testing itself, plus the shell's `protocol`, `runtime` and `cli` | 100% of executable production code; CLI verification includes arguments, failure paths and process exit |
| Repository-owned executable automation, including build, test, packaging and release logic | 100% executable-code coverage, with behavior and process-boundary checks appropriate to the operation |
| YAML and other non-executable configuration | Applicable schema/configuration validation and workflow checks; no executable-code coverage percentage |
| A module's `protocol`, `runtime` and `cli` | 100% of executable production code. Where a part drives an external tool, doubles cover parsing, routing and lifecycle; behavior only the real tool can exercise needs separately authorized live verification and explicit accounting of uncovered lines |
| Angular packages: the shell's `window` and `ui`, and a module's `window` | Component and service verification through the framework's testing surface, plus the desktop UI workflow gate in section 6 |
| `src/shell/desktop` | Application-launch verification, process-boundary tests through appropriate doubles and real-process checks, and the desktop UI workflow gate in section 6 |

Define additional packages' coverage and scope before claiming a complete gate. Non-executable definitions need no artificial tests; other exclusions are explicit, justified and reported, including behavior requiring live services. Executable scripts retain their coverage obligations. Inline workflow scripts stay small and carry no coverage percentage; their tests run the exact text from the workflow against doubles of the tools it calls.

Unmeasurable bootstrap work is incomplete verification, not a coverage exception. Record the files, missing capability and actual checks in the issue/PR; close the gap before claiming a complete pass.

Measure the complete executable inventory, including unloaded files as uncovered. Missing coverage, invalid ranges, malformed reports or unusable required source maps fail analysis; they never reduce its denominator. Keep paths and package identities unambiguous across operating systems and installations.

The Node-bootstrap adapter uses the selected runtime's coverage and build source maps; verify their formats/mapping against the pinned toolchain. Source changes require fresh artifacts and matching maps. Source/package drift invalidates results.

Report covered/executable file counts and percentages against the tested source identity. Raw block totals are run diagnostics, not revision fingerprints; retain discrepancies rather than rewriting earlier observations.

## 6. Verification scope

Documentation changes require content, consistency, link and formatting checks. Verified commands and prerequisites belong in README or the owning tooling guide when available; do not invent commands for missing tooling.

Automatic PR and `main` push runs skip the code build/test matrix only when every changed path is Markdown at the root, under `docs/` or under `.github/`, or a module's `README.md`. All other changes require the full matrix. Check both rename paths; compare PRs from their merge base and pushes from the previous revision. Empty comparisons, unavailable history and manual runs select the full matrix.

The aggregate check reports documentation-only skips and fails on classification failure or any failed, cancelled or unexpectedly skipped required target. PR-description/issue validation still runs. Packaging and releases remain explicit manual or tag-triggered operations with complete verification.

Build, pack and install the selected source before testing its package API; dependencies must resolve to those fresh artifacts. Use targeted checks during development and the complete applicable gate before handoff. Repeat successful checks only after a change, failure or unresolved concern.

Before pushing for review:

- Merge the current `main` into the branch and run the gate on the result.
- Run a new or changed test of processes, timing or platform behavior 10 times in a row on Windows and Linux; one pass does not show it is stable.
- Check a configuration change, such as a workflow, with the tool that reads it.

Name additional evidence according to the claim:

- Fixtures verify an adapter's inputs, outputs and lifecycle. They do not prove that the real external tool applies supplied instructions or supports a control.
- Protocol and persistence changes need the relevant serialization, compatibility, migration, interruption and recovery checks through their owning boundaries.
- Angular specs verify component behavior. Native-window evidence is needed for claims involving Electron, OS integration or actual desktop interaction.
- Packaging or cross-compilation does not establish execution on a target. Installer and update claims require the corresponding native checks under the architecture's delivery contract, including existing data and install scope where relevant.

Ordinary checks use fixtures without sign-in to an external service or paid use. Separately authorized live checks record the actual service, tool version, observed settings and scope; missing observations remain unknown.

Performance claims require representative workloads, recorded conditions and repeated measurements outside coverage. Check scaling separately; ordinary unit tests impose no machine-dependent speed thresholds. Missing measurements remain unknown; speed alone proves neither allocation nor retention improvements.

### Desktop UI automation

Required Playwright workflows drive the actual Electron window, preload and runtime using generated data and service fixtures. They complement package/Angular tests; a browser page with a mocked bridge is insufficient. [UI-STANDARDS.md](UI-STANDARDS.md) owns appearance, behavior and accessibility.

The complete UI gate runs shared critical workflows natively on every target in the architecture's [delivery matrix](ARCHITECTURE.md#10-build-installation-and-updates).

Use one shared suite with explicit platform-specific launch, path, keyboard and display behavior. Record OS, CPU, runner image/environment, application revision, Playwright, Electron and host Node versions; distinguish Electron's embedded Node. Cross-compilation, emulation and another architecture's pass do not certify a native target. Section 4's gate rules apply to every required target; targeted runs establish only their scope.

Pin the test dependencies when tooling is introduced. Verify the exact Playwright/Electron combination and its application configuration on each target before relying on it, and repeat the relevant compatibility checks when those dependencies or runner images change. The test host must supply the required native libraries and a working display; Linux CI may use Xvfb. A local WSL graphical-session pass is not a GitHub-hosted VM or Xvfb witness.

Keep the application's sandbox, context isolation, web security and content security policy intact. Inspect packaging and debugger/fuse requirements explicitly; do not weaken a production binary merely to let automation attach. If an automation-specific launch configuration or test build is required, record its differences and retain separate acceptance checks for the actual distributed binary. The shared suite launches with GPU acceleration and software GL turned off, so WebGL is unavailable; drawing with WebGL needs its own check in the application with GPU acceleration. Native OS dialogs, clipboard integration, installers and updates need their own applicable checks; substituting a fixture for one of those operations does not verify the OS behavior.

The shell's workflows cover starting with no module, docking and arranging tabs, layout restoration, Settings transitions, commands and shortcuts, and relevant focus, keyboard and popup behavior; they exercise contributions through fixture modules that exist only for tests, live in the `fixtures` beside the workflows and enter only a test build's module list under the [architecture](ARCHITECTURE.md#2-components-and-dependency-direction). Each module adds the workflows of its own capabilities, run in the application with the modules it depends on. Extend them when an accepted UI capability adds a distinct user workflow. Assert meaningful application results, not merely that a click succeeded. Use stable accessible roles and names where possible, wait for observable state rather than arbitrary sleeps, and collect unexpected main-process, preload and renderer failures as part of the result.

Verify normal closure, interruption and failure cleanup, including child processes, under section 3's isolation rules. Disable retries for qualification; diagnostic retries preserve failures and do not turn flaky behavior into an unqualified pass.

### UI screenshots and reports

Name screenshot checkpoints and attach relevant page/component captures to their test/step, including passing runs. On failure, retain a trace and capture any usable window. Report capture failure without replacing the original failure.

Capture established UI state using declared animation policy and framework stabilization; generic waits must not misread animation cancellation as failure. Test animations explicitly when relevant. Record platform, viewport, scale, theme, mode and font settings.

The shared desktop UI suite uses a 1920 × 1080 renderer viewport at one device pixel per CSS pixel at normal zoom. Captures remain 1920 × 1080 pixels during zoom tests; the recorded CSS viewport and pixel ratio reflect the zoom. Verify the actual viewport and PNG dimensions so host display defaults cannot silently reduce the evidence resolution.

Screenshots are review evidence. Pixel assertions require a reviewed baseline, controlled rendering and appropriate platform expectations; baseline changes require review, never automatic acceptance of differences. Retain behavior, computed-style, contrast and accessibility checks.

CI reports expose identities, steps, outcomes, screenshots and traces under an explicit artifact-retention policy. Preserve startup, execution, capture and cleanup failures. Section 8 governs committed evidence; results apply only to the recorded build/environment.

GitHub summaries include UI outcomes, duration and bounded failure details beside package results, with complete totals. Link a separate main-window PNG per target for browser viewing; retain downloadable HTML reports and traces without separate hosting.

## 7. Verification of the testing infrastructure

Before relying on the package runner or a changed reporting path, use controlled negative fixtures through its real entry point. Verify assertion failures, throws, rejected promises, timeouts, unexpected late errors, malformed discovery, declared skips and incomplete results. The outer test asserts their expected failure classifications without allowing the deliberately failing child to appear as a successful product test run.

Coverage checks must demonstrate that an unloaded executable file, a genuine uncovered branch and malformed required coverage data cannot produce a complete result. Aggregation checks must demonstrate that a failing prerequisite, cancelled process or missing report cannot produce a green summary. Verify process exit as well as the reported failure; a printed error is not evidence that the runner stopped.

## 8. Evidence and handoff

Record scope, revision/snapshot, toolchain, platform, commands, outcomes and limits in the issue/PR, linking CI and selected redacted artifacts. Evidence creates neither a second progress document nor a product-contract amendment.

Retain each attempt's stdout/stderr separately under the retention policy. Keep redacted reproduction steps and relevant assertion/stack details in the issue/PR after artifacts expire; link full logs, screenshots and traces. A passing rerun does not erase unexplained failure.

Commit only reviewed evidence with lasting regression/reference value, including baselines and fixtures; keep routine logs out of source control. All evidence follows the coding standards' redaction rules.

If a required check could not run, state the missing claim plainly. Old evidence, a copied package, user-reported success or a fixture-only run must not be presented as newly verified implementation.
