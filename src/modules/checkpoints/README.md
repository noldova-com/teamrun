# Checkpoints

**Scope:** The `checkpoints` module, under the [architecture's storage rules](../../../docs/ARCHITECTURE.md#7-state-and-persistence).

## 1. Purpose

A checkpoint captures the files of a working folder at one moment: a project's folder, or the folder of a conversation without a project. The module captures and compares checkpoints; restoration requires a user request.

Git holds file content; other records, including conversations and settings, remain in their owners' databases.

## 2. Storage

- Keep one repository per working folder in the module's data-directory folder, with every object needed for restoration.
- Reference the working folder's stable identity published by the module that owns it. The architecture governs device-local paths and reconnection; missing folders are reported, never classified as unchanged.
- Module records identify checkpoints in these repositories.
- Captures and restores for one working folder run one at a time; a request that arrives during one waits for it.

## 3. TeamRun's Git

Use only TeamRun-delivered Git; never discover or run an installed copy. System, user and project configuration, ignore rules, attributes and filters have no effect; no hooks run. TeamRun's own policy selects files, stored and restored byte for byte.

Never read, modify, run Git against or depend on the person's repository storage, index, branches, references or configuration. Exclude that storage from both capture and restoration.

## 4. Missing decisions

Resolve these before dependent implementation:

- **Git implementation:** bundled program or library, measured for large-project speed, target behavior, installer size and distribution-license obligations.
- **File policy:** exclusions and file/repository size limits, including treatment of dependencies and build output.
- **Consistency:** database records and Git objects cannot commit together; define authority and recovery when either is missing.
- **Interruption:** recover interrupted capture and restoration after application or machine failure.
- **Restore conflicts:** define the preview and treatment of later user/agent edits that restoration would overwrite.
- **Retention:** define checkpoint lifetime and storage cleanup.
