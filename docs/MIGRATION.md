# Moving onto the shell packages

**Scope:** The plan for replacing TeamRun's own shell with the shared base's shell packages: what each area of the repository becomes, the order of the pull requests, what must not be lost and the decisions still open.

The base, in the `desktop-core` repository, is the shell TeamRun's own shell was copied from: the same foundation, protocol, runtime, command line, desktop, kit and window, without TeamRun's modules.
It is to ship as `@noldova/*` npm packages that carry the installer build, the signing step and the updater, and an app is then its modules, its identity and a call to a shared release workflow, per desktop-core#6, which settles the app repository's shape.
TeamRun moves onto those packages in place, in this repository, replacing its own shell in pull requests that each keep `main` green and keep the repository's history.
That is the decided direction: the history, issues, pull requests, releases, update address and required checks all stay where they are.

Comparable families of desktop apps share one framework, shipped as packages, and keep each app's identity, modules and releases in the app's own repository; this plan does the same.

## 1. The areas

Each top-level area of `src/`, `scripts/` and `.github/` is marked:

- **Replaced:** a base package or the base's shared workflow takes its place, and the area is removed in the pull request that switches to it.
- **Kept:** it stays TeamRun's own.
- **Later:** what the app repository holds here is not settled yet, per desktop-core#6, or it waits for another [open decision](#5-open-decisions); it stays as it is until then.

### `src/`

| Area | Mark | Reason |
|---|---|---|
| `foundation/` (`core`, `exceptions`, `json`, `testing`, `text`) | Replaced | The base's `@noldova/foundation-*` packages hold the same five packages |
| `shell/protocol/` | Replaced | `@noldova/desktop-protocol` |
| `shell/runtime/` | Replaced | `@noldova/desktop-runtime` |
| `shell/cli/` | Replaced | `@noldova/desktop-cli`; TeamRun's command name comes from its identity |
| `shell/desktop/` | Replaced | `@noldova/desktop-electron`, the same part under the base's name |
| `shell/ui/` | Replaced | The base's kit, `@noldova/components`, which has a private manifest and is not published yet; whether and how it ships is per desktop-core#6 |
| `shell/window/` | Replaced | The base's window, which its Angular parts import as `@noldova/desktop-window` but which has no manifest; whether and how it ships is per desktop-core#6 |
| `modules/` | Kept | TeamRun's modules are the app: checkpoints, conversations, first-run, providers and teammates |
| `angular.json`, `package.json`, `package-lock.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.spec.json`, `vitest.config.mts`, `.npmrc` | Later | The app keeps an Angular project for its modules' window parts, but its shape depends on how the base ships the window and the kit, per desktop-core#6 |

### `scripts/`

The base's `scripts/` holds the same files as TeamRun's.
What an app runs itself, and what comes to it from a base package or a shared workflow, is not decided yet, except for releasing, which desktop-core#6 gives to the packages and the shared workflow.

| Area | Mark | Reason |
|---|---|---|
| `packaging/`, `packages/`, `release/`, `package.ts`, `package-smoke.ts`, `release-assets.ts`, `release-check.ts`, `release-publish.ts`, `signed-platforms.ts` | Replaced | The installer build, signing, the update feed and releasing move into the base's packages and its shared release workflow |
| `desktop/`, `toolchain/` | Replaced | They fetch the Electron binary and build the runtime's native addon, which the base's desktop and runtime packages are to carry, per desktop-core#6 |
| `modules/`, `ordering/` | Later | They read the build's module list and declarations for the build runner, and follow it, per desktop-core#6 |
| `build.ts`, `test.ts`, `test-part.ts`, `test-options.ts`, `test-options.exception.ts`, `list-targets.ts`, `classify-changes.ts`, `tsconfig.json` | Later | The build and test runner; an app needs one for its modules, from the base or its own, per desktop-core#6 |
| `checks/`, `structure/`, `api/`, `angular/` | Later | The structure, API and Angular checks; most apply to any app, and those for TeamRun's modules must stay ([What must not be lost](#4-what-must-not-be-lost)), per desktop-core#6 |
| `documents/`, `format-documents.ts` | Later | The document checks, which TeamRun's module documents need whoever carries them, per desktop-core#6 |
| `processes/`, `repository/`, `totals/`, `run-totals.ts` | Later | Helpers the runner, the checks and the reports share; they follow those, per desktop-core#6 |
| `workflows/`, `ui-workflows.ts`, `ui-summary.ts` | Later | Change classification, the job plan and the UI workflows' reports, which follow the workflows that run them, per desktop-core#6 |
| `nightly-report.ts`, `nightly-result.ts`, `flaky-report.ts`, `flaky-week-summary.ts`, `watch-pull-requests.ts` | Later | The nightly, flake and pull-request tooling, which must not be lost; it stays until the base carries it, per desktop-core#6 |
| `tests/` | Later | The scripts' tests follow the scripts they test, area by area, per desktop-core#6 |

### `.github/`

| Area | Mark | Reason |
|---|---|---|
| `workflows/release.yml`, `workflows/package.yml` | Replaced | A call to the base's shared release workflow takes their place; the base's own release workflow is not reusable yet |
| `workflows/build-and-test.yml`, `workflows/build-and-test-target.yml`, `workflows/ui-workflows.yml` | Later | They run the build, the tests and the UI workflows, from the base's reusable workflows or TeamRun's own, per desktop-core#6 |
| `workflows/nightly.yml`, `workflows/flaky-tests.yml`, `workflows/watch-pull-requests.yml` | Later | The nightly repeats, the flake reports and the pull-request watcher, which must not be lost, per desktop-core#6 |
| `workflows/require-linked-issue.yml`, `workflows/clear-work-labels.yml` | Kept | They hold this repository's own issue and pull-request rules |
| `actions/` (`prepare`, `ui-workflows`) | Later | They follow the workflows that use them, per desktop-core#6 |
| `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, `SECURITY.md` | Kept | They belong to the repository, whatever builds it |

Outside these three areas, the root `package.json` keeps TeamRun's identity and module list, `assets/` keeps its icons, and `docs/` keeps the rules that are TeamRun's own while the shell's rules move to the base's documents (the last pull request below).

## 2. The pull requests

Each pull request switches one layer to the base's packages and removes TeamRun's copy of it in the same change, so `main` never holds two copies of a layer.
It also switches every remaining TeamRun copy that imports that layer, the scripts and the fixture modules included, to the base's package, so `main` builds after each one.
TeamRun's modules hold only their design documents today, so nothing in them switches until their code lands.
Each runs every required check on every target before it merges, and none rewrites history: files are removed by ordinary commits, so the history of everything kept, above all `src/modules/`, stays whole.

| Order | Pull request | Base needs |
|---|---|---|
| 1 | Foundation: every shell copy and the scripts import `@noldova/foundation-*`, pinned to one version, and `src/foundation/` goes | The five foundation packages published, with the API TeamRun's copies use |
| 2 | Protocol: the runtime, the command line, the desktop and the window import `@noldova/desktop-protocol`, and `src/shell/protocol` goes | The protocol package published, with the API those copies use |
| 3 | Runtime: the command line and the desktop import `@noldova/desktop-runtime`, and `src/shell/runtime` goes | The runtime package published, reading the app's module list and identity from the app's manifest, with the runtime's native addon built in its package |
| 4 | Kit: the window imports the base's kit, and `src/shell/ui` goes | The kit shipped in a form an app's Angular project builds, with its Gallery |
| 5 | Command line: TeamRun runs `@noldova/desktop-cli`, and `src/shell/cli` goes | The command-line package published, taking the app's command name from its identity |
| 6 | Window: TeamRun's Angular project builds the base's window with the modules' window parts, and `src/shell/window` goes | The window shipped in a form an app's Angular project builds, with its generated module entries |
| 7 | Desktop: TeamRun runs `@noldova/desktop-electron`, and `src/shell/desktop` goes | The desktop package published, taking the app's identity, icons and update address |
| 8 | Build, test and checks: TeamRun runs the base's runner and checks, keeping its own where the base has none | The decision on how the base gives apps its tooling, and checks that take an app's modules and documents |
| 9 | Releasing: `release.yml` calls the base's shared release workflow, and the packaging and release scripts and `package.yml` go | The shared release workflow and its inputs and outputs, the packages' installer build, signing and updater, the signing secrets in place for TeamRun, and both of its approval gates (desktop-core#6) |
| 10 | Workflows: the build, UI, nightly, flake and watcher workflows use the base's reusable workflows where it offers them | Reusable workflows for those jobs, or the decision that apps keep their own |
| 11 | Documents: the owner table points the shell's rules to the base's documents, and TeamRun's copies of them go, keeping what is TeamRun's own | The base's documents published for apps to link |

The order follows what each copy imports: the foundation first, then the protocol, then the runtime and the kit, which need only those, then the command line, which needs the runtime, and the window, which needs the protocol and the kit, and the desktop last, which needs the protocol and the runtime.
Pull requests 3 and 4 may go in either order, as may 5 and 6; 8 to 11 follow 7 in any order the base's needs allow.

A pull request whose base need is not met waits; none works around a missing package by copying the base's code again.

## 3. Checking each step

- The full suite, the UI workflows and a packaged build of every target run on each pull request, as on any change to the shell today.
- A packaged build installs over the last released TeamRun and keeps its data, its settings and its sign-in to the command lines.
- The tests of the remaining shell copies and of the scripts pass unchanged in pull requests 1 to 7: a test that must change shows that the base's API differs from TeamRun's copy, which is a base need, not a change to make here.
  TeamRun's modules have no code or tests yet; once they do, their tests join this rule.

## 4. What must not be lost

- **Product identity:** the name, the publisher, the slug, the application ids, the data folder `.noldova/teamrun`, the device folders, the data-directory variable `TEAMRUN_DATA_DIR`, the icons, the Windows publisher name and the release repository, all in the root `package.json`.
  Installed copies find their data and their updates through these, so none changes in the move.
- **The update address:** installed copies look for updates in the releases of `noldova-com/teamrun`, which the move in place keeps.
- **Release secrets and gates:** the `release` environment's signing secrets for Windows and macOS stay until the shared workflow's secrets are in place; the maintainer moves them, and no pull request reads or copies a value.
  Both of `release.yml`'s approval gates stay: the `release` environment's, before signing, and the `publish` environment's, with its own reviewers and branch rule, before publishing, so a shared workflow never publishes a release no one approved.
- **Checks the base doesn't carry:** the checks of TeamRun's modules (their imports, folders, names and declarations), the document checks of their documents, the product-identity check with TeamRun's values, and the required checks' names, which the branch protection and the merge queue use, and the name of the "Build and test" workflow, which the flake reports follow.
- **Nightly and flake tooling:** the nightly repeats, the flake reports and their weekly summary, the issues they file and their labels, and the pull-request watcher.
- **History:** `main`'s commits, the issues and pull requests, the releases and their tags, and the flake issues' records.

## 5. Open decisions

Waiting for the base's app-on-shell design (desktop-core#6):

- **The shared release workflow:** its inputs and outputs, where each app's signing secrets live, and how it keeps both approval gates in TeamRun's repository, the `release` environment's before signing and the `publish` environment's before publishing; desktop-core#6 names only the first, so TeamRun asks for the second there.
- **Packages and versions:** when the packages are published, how TeamRun pins and updates them, and how a base change that breaks a module reaches TeamRun.
- **The window and the kit:** whether they ship as packages built from source in the app's Angular project or as built libraries, and whether the kit moves to a repository of its own.
- **Tooling:** whether the runner, the checks and the reports come to apps as a package, as reusable workflows or not at all, and which checks the base runs on an app's modules.
- **The manifest:** per desktop-core#6, the key under which an app declares its modules and identity, which is `teamrun` in TeamRun and `desktop` in the base.

TeamRun's own:

- **The order of 8 to 11:** settled once the base's needs for them are known.
