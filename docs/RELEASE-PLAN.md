# Release plan

This note sequences the work that takes TeamRun from the repository to installers people download and an application that updates itself. [ARCHITECTURE.md](ARCHITECTURE.md#10-build-installation-and-updates) owns the requirements; this note owns their order, the acceptance of each step and the decisions still open. Entries marked "pending Ross" are working defaults until Ross decides.

## Shape

```text
reviewed revision on main
        |  build once (all six targets)
        v
 build artifacts: unsigned packages + checksums + update metadata
        |  signing jobs, only for targets the release declares signed
        v
 signed packages  --- publish job (the only job that may publish) ---> GitHub release vN.N.N
                                                                         |
                                       installed application <-- anonymous HTTPS: latest-<platform>-<arch>.yml
```

- One version, the product version in the root manifest, for the shell and every module.
- Tag `vN.N.N` on the reviewed revision; assets `TeamRun-<platform>-<arch>.<ext>` and `latest-<platform>-<arch>.yml`, with no version in any file name.
- The feed is the public repository's GitHub releases, over anonymous HTTPS. No credential is injected into the application or its updater.

## Steps

Each step is an issue with its own pull request and native acceptance. A later step may start once the earlier step's interfaces are agreed, but not before.

### 1. Packaging

- Package the build output for Windows NSIS, macOS DMG plus ZIP and Linux AppImage, each on x64 and ARM64, with ASAR and narrowly identified unpacked files.
- The product identity (name, publisher, application ID, icons) comes only from `teamrun.product`.
- Tests install the fresh package and start it; they never use a stale artifact.
- Acceptance: each target's package installs, starts, shows the shell with its modules and uninstalls, on the machines of that OS where one exists.

### 2. Update backend

- Check the feed for the installed platform and CPU, compare versions (only a newer version is offered), and validate the metadata and the downloaded bytes before offering installation.
- Download and restart-and-install are explicit actions; closing the application never installs. Section 9's question about work in progress runs before the restart.
- On Windows an update installs only when TeamRun's publisher signed it: the updater is configured with the publisher's name and checks the downloaded installer's signature against it, in addition to the update metadata's checksum. A package signed by anyone else, or unsigned, is refused with a message that says why.
- A source build, a development build and an incompatible target never read the production feed.
- Acceptance: tests with a local feed cover a newer version, the same or an older version, a corrupt download, malformed metadata and a signature that does not match; the Windows publisher refusal is shown natively with an installer signed by another publisher.

### 3. Pre-install coordination

- Before application files are replaced: no work in progress, block new launches and requests, acknowledge unsaved state and preferences, stop module-owned processes, flush and close databases, verify process exit, and create verified backups.
- A failure before the installer's handoff resumes the surviving clients; uncertainty is not a successful shutdown. After an AppImage update the new version starts once the old process has exited, from outside the old image.
- macOS runs from an Applications folder; an installation that cannot update itself explains why.
- Acceptance: workflows for each sequence step and each failure, then a native update from the previous release on every accepted target.

### 4. Release workflow

- A build job produces every target's artifacts once and identifies them. A separate publish job takes exactly that artifact, including on a retry that only publishes, and has the only authority to create the release.
- Uploads retry a bounded number of times and verify an existing outcome first. An incomplete release stays unpublished; a published tag or asset is never replaced silently.
- A release starts only by manual dispatch of a named revision and version (pending Ross).
- The workflow's scripts follow the repository's script standards and the testing contract's full coverage of release logic.
- Acceptance: a dispatched run publishes the release and a retry of the publish job leaves it unchanged; every failure path has a test.

### 5. Signing

- Windows: the repository's own signing step through electron-builder, with the signing module pinned to an exact version. macOS: signing with notarization. Linux AppImages are not signed.
- Only the packaging job of a target the release declares signed receives credentials, and publication rejects a package whose signing differs from that declaration.
- Production signing is distinct from an explicitly authorized unsigned test release. A signed run uses credentials and needs Ross's explicit authorization each time.
- Acceptance: signed packages verify as signed by the product's publisher on Windows and as notarized on macOS; an unsigned package is rejected where the release declares signing.

### 6. Native acceptance per target

- A target is declared supported only after its build and native acceptance are verified, including an update from the previous release. Release notes name the targets whose acceptance is a CI test only.
- Acceptance by target is listed below.

## Targets

| Target | Build | Native acceptance (pending Ross) |
|---|---|---|
| Windows x64 | Yes | Yes, now |
| Windows ARM64 | Yes | CI tests only; release notes say so |
| Linux x64 | Yes | Yes, now |
| Linux ARM64 | Yes | CI tests only; release notes say so |
| macOS x64 | Yes | Yes, now |
| macOS ARM64 | Yes | When the Apple Silicon Mac arrives |

## Decisions pending Ross

| Decision | Working default |
|---|---|
| First release | An unsigned v0.0.1 prerelease proves the pipeline; signed releases follow |
| Targets | As in the table above |
| macOS and Windows signing identities and who holds them | Blank |
| Update channels | The latest release only |
| Who starts a release | Ross, by manual dispatch |
| Where this note lives | `docs/RELEASE-PLAN.md`, linked from the architecture's section 10 and the documents table |

## Changes this note needs in other documents

- Section 10 does not yet say that Windows installs an update only when TeamRun's publisher signed it. Add it to Updates; step 2 depends on it.
- Section 10 says releases carry no prerelease suffixes and each publication becomes the latest release. A GitHub prerelease is not "latest" and is invisible to the updater's default feed. State how an unsigned test release is published, and that it never enters the update feed.
- An unsigned release cannot prove the Windows update path, because the publisher rule refuses it. The first update acceptance on Windows therefore needs a signed release, or a test publisher that only a test build trusts.
