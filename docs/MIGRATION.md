# Moving onto the shell packages

**Scope:** The plan for replacing TeamRun's own shell with the shared base's shell packages: what each area of the repository becomes, the order of the pull requests, what must not be lost and the decisions still open.

The base, in the `desktop-core` repository, is the shell TeamRun's own shell was copied from: the same foundation, protocol, runtime, command line, desktop, kit and window, without TeamRun's modules.
It is to ship as `@noldova/*` npm packages that carry the installer build, the signing step and the updater, and an app is then its modules, its identity and a call to a shared release workflow (desktop-core#6).
TeamRun moves onto those packages in pull requests that each keep `main` green and keep the repository's history.

Comparable families of desktop apps share one framework, shipped as packages, and keep each app's identity, modules and releases in the app's own repository; this plan does the same.

## 1. The areas

Each top-level area of `src/`, `scripts/` and `.github/` is marked:

- **Replaced:** a base package or the base's shared workflow takes its place, and the area is removed in the pull request that switches to it.
- **Kept:** it stays TeamRun's own.
- **Later:** it waits for a decision in [Open decisions](#5-open-decisions); it stays as it is until then.

### `src/`

| Area | Mark | Reason |
|---|---|---|
| `foundation/` (`core`, `exceptions`, `json`, `testing`, `text`) | Replaced | The base's `@noldova/foundation-*` packages hold the same five packages |
| `shell/protocol/` | Replaced | `@noldova/desktop-protocol` |
| `shell/runtime/` | Replaced | `@noldova/desktop-runtime` |
| `shell/cli/` | Replaced | `@noldova/desktop-cli`; TeamRun's command name comes from its identity |
| `shell/desktop/` | Replaced | `@noldova/desktop-electron`, the same part under the base's name |
| `shell/ui/` | Replaced | The base's kit, which it imports as `@noldova/components` and which is not a package yet |
| `shell/window/` | Replaced | The base's window, `@noldova/desktop-window`, which is not a package yet |
| `modules/` | Kept | TeamRun's modules are the app: checkpoints, conversations, first-run, providers and teammates |
| `angular.json`, `package.json`, `package-lock.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.spec.json`, `vitest.config.mts`, `.npmrc` | Later | The app keeps an Angular project for its modules' window parts, but its shape depends on how the base ships the window and the kit |

### `scripts/`

The base's `scripts/` holds the same files as TeamRun's.
What an app runs itself, and what comes to it from a base package or a shared workflow, is not decided yet, except for releasing, which desktop-core#6 gives to the packages and the shared workflow.

| Area | Mark | Reason |
|---|---|---|
| `packaging/`, `packages/`, `release/`, `package.ts`, `package-smoke.ts`, `release-assets.ts`, `release-check.ts`, `release-publish.ts`, `signed-platforms.ts` | Replaced | The installer build, signing, the update feed and releasing move into the base's packages and its shared release workflow |
| `desktop/`, `toolchain/` | Replaced | They fetch the Electron binary and build the runtime's native addon, which the base's desktop and runtime packages carry |
| `modules/`, `ordering/` | Replaced | They read the build's module list and declarations, which the base's build does for any app |
| `build.ts`, `test.ts`, `test-part.ts`, `test-options.ts`, `test-options.exception.ts`, `list-targets.ts`, `classify-changes.ts`, `tsconfig.json` | Later | The build and test runner; an app needs one for its modules, from the base or its own |
| `checks/`, `structure/`, `api/`, `angular/` | Later | The structure, API and Angular checks; most apply to any app, and those for TeamRun's modules must stay ([What must not be lost](#4-what-must-not-be-lost)) |
| `documents/`, `format-documents.ts` | Later | The document checks, which TeamRun's module documents need whoever carries them |
| `processes/`, `repository/`, `totals/`, `run-totals.ts` | Later | Helpers the runner, the checks and the reports share; they follow those |
| `workflows/`, `ui-workflows.ts`, `ui-summary.ts` | Later | Change classification, the job plan and the UI workflows' reports, which follow the workflows that run them |
| `nightly-report.ts`, `nightly-result.ts`, `flaky-report.ts`, `flaky-week-summary.ts`, `watch-pull-requests.ts` | Later | The nightly, flake and pull-request tooling, which must not be lost; it stays until the base carries it |
| `tests/` | Later | The scripts' tests follow the scripts they test, area by area |

### `.github/`

| Area | Mark | Reason |
|---|---|---|
| `workflows/release.yml`, `workflows/package.yml` | Replaced | A call to the base's shared release workflow takes their place; the base's own release workflow is not reusable yet |
| `workflows/build-and-test.yml`, `workflows/build-and-test-target.yml`, `workflows/ui-workflows.yml` | Later | They run the build, the tests and the UI workflows, from the base's reusable workflows or TeamRun's own |
| `workflows/nightly.yml`, `workflows/flaky-tests.yml`, `workflows/watch-pull-requests.yml` | Later | The nightly repeats, the flake reports and the pull-request watcher, which must not be lost |
| `workflows/require-linked-issue.yml`, `workflows/clear-work-labels.yml` | Kept | They hold this repository's own issue and pull-request rules |
| `actions/` (`prepare`, `ui-workflows`) | Later | They follow the workflows that use them |
| `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `SECURITY.md` | Kept | They belong to the repository, whatever builds it |

Outside these three areas, the root `package.json` keeps TeamRun's identity and module list, `assets/` keeps its icons, and `docs/` keeps the rules that are TeamRun's own while the shell's rules move to the base's documents (the last pull request below).

## 2. The pull requests

Each pull request switches one layer to the base's packages and removes TeamRun's copy of it in the same change, so `main` never holds two copies and never depends on a half-switched layer.
Each runs every required check on every target before it merges, and none rewrites history: files are removed by ordinary commits, so the history of everything kept, above all `src/modules/`, stays whole.

| Order | Pull request | Base needs |
|---|---|---|
| 1 | Foundation: the modules and scripts import `@noldova/foundation-*`, pinned to one version, and `src/foundation/` goes | The five foundation packages published, with the API TeamRun's copy has |
| 2 | Protocol, runtime and command line: the modules' parts import `@noldova/desktop-protocol`, `-runtime` and `-cli`, and `src/shell/protocol`, `runtime` and `cli` go | Those packages published; the runtime and the command line reading the app's module list and identity from the app's manifest; the runtime's native addon built in its package |
| 3 | Desktop: TeamRun runs `@noldova/desktop-electron`, and `src/shell/desktop` goes | The desktop package published, taking the app's identity, icons and update address |
| 4 | Kit and window: TeamRun's Angular project builds the base's window and kit with its modules' window parts, and `src/shell/ui` and `src/shell/window` go | The kit and the window shipped in a form an app's Angular project builds, with their Gallery and their generated module entries |
| 5 | Build, test and checks: TeamRun runs the base's runner and checks, keeping its own where the base has none | The decision on how the base gives apps its tooling, and checks that take an app's modules and documents |
| 6 | Releasing: `release.yml` calls the base's shared release workflow, and the packaging and release scripts and `package.yml` go | The shared release workflow and its inputs and outputs, the packages' installer build, signing and updater, and the signing secrets in place for TeamRun (desktop-core#6) |
| 7 | Workflows: the build, UI, nightly, flake and watcher workflows use the base's reusable workflows where it offers them | Reusable workflows for those jobs, or the decision that apps keep their own |
| 8 | Documents: the owner table points the shell's rules to the base's documents, and TeamRun's copies of them go, keeping what is TeamRun's own | The base's documents published for apps to link |

Pull requests 1 to 4 go in order, since each layer imports the one before it; 5 to 8 follow 4 in any order the base's needs allow.
A pull request whose base need is not met waits; none works around a missing package by copying the base's code again.

## 3. Checking each step

- The full suite, the UI workflows and a packaged build of every target run on each pull request, as on any change to the shell today.
- A packaged build installs over the last released TeamRun and keeps its data, its settings and its sign-in to the command lines.
- The tests of TeamRun's modules pass unchanged in pull requests 1 to 4: a module test that must change shows that the base's API differs, which is a base need, not a module change.

## 4. What must not be lost

- **Product identity:** the name, the publisher, the slug, the application ids, the data folder `.noldova/teamrun`, the device folders, the data-directory variable `TEAMRUN_DATA_DIR`, the icons, the Windows publisher name and the release repository, all in the root `package.json`.
  Installed copies find their data and their updates through these, so none changes in the move.
- **The update address:** installed copies look for updates in the releases of `noldova-com/teamrun`; the move keeps that address, or the last release from it points installed copies to the new one.
- **Release secrets:** the `release` environment's signing secrets for Windows and macOS, and its approval gate, stay until the shared workflow's secrets are in place; the maintainer moves them, and no pull request reads or copies a value.
- **Checks the base doesn't carry:** the checks of TeamRun's modules (their imports, folders, names and declarations), the document checks of their documents, the product-identity check with TeamRun's values, and the required checks' names, which the branch protection and the merge queue use.
- **Nightly and flake tooling:** the nightly repeats, the flake reports and their weekly summary, the issues they file and their labels, and the pull-request watcher.
- **History:** `main`'s commits, the issues and pull requests, the releases and their tags, and the flake issues' records.

## 5. Open decisions

Waiting for the base's app-on-shell design (desktop-core#6):

- **The shared release workflow:** its inputs and outputs, where each app's signing secrets live, and how signing keeps the `release` environment's approval gate in TeamRun's repository.
- **Packages and versions:** when the packages are published, how TeamRun pins and updates them, and how a base change that breaks a module reaches TeamRun.
- **The window and the kit:** whether they ship as packages built from source in the app's Angular project or as built libraries, and whether the kit moves to a repository of its own.
- **Tooling:** whether the runner, the checks and the reports come to apps as a package, as reusable workflows or not at all, and which checks the base runs on an app's modules.
- **The manifest:** the key under which an app declares its modules and identity, which is `teamrun` in TeamRun and `desktop` in the base.

TeamRun's own:

- **In place or a new repository:** this plan moves TeamRun in place, keeping its history, issues, pull requests, releases, update address and required checks; starting a new repository and archiving this one would lose them from the working repository, so it is not recommended.
- **The order of 5 to 8:** settled once the base's needs for them are known.
