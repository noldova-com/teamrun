/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { SetVersion } from "../../set-version.ts";
import { SetVersionException } from "../set-version.exception.ts";
import { VersionSetter } from "../version-setter.ts";

const folders: string[] = [];
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PREFACE = "# Changelog\n\nIntro.\n";
const OLDER = "## 0.0.2\n\n- Older fix.\n";
const CHANGELOG = `${PREFACE}\n## Unreleased\n\n### Fixed\n\n- **First fix:** it works.\n  In 0.0.2 it didn't.\n- **Second fix:** it works too.\n\n### Added\n\n- **A feature:** new.\n\n${OLDER}`;
const MANIFEST = (fields: Readonly<Record<string, unknown>>): string => `${JSON.stringify({ name: "x", version: "0.0.2", ...fields }, null, 2)}\n`;

const createRoot = (changelog: string = CHANGELOG): string => {
  const root = mkdtempSync(path.join(tmpdir(), "version-setter-"));
  folders.push(root);
  const files: Readonly<Record<string, string>> = {
    "version.json": "{ \"version\": \"0.0.2\" }\n",
    "CHANGELOG.md": changelog,
    "src/noldova.teamrun/module.json": "{\n  \"id\": \"teamrun\",\n  \"version\": \"0.0.2\",\n  \"dependencies\": { \"terminal\": \"0.0.2\" }\n}\n",
    "src/noldova.teamrun/package.json": MANIFEST({ name: "@noldova/teamrun", version: "__VERSION__" }),
    "src/noldova.teamrun.core/package.json": MANIFEST({ name: "@noldova/teamrun.core", version: "__VERSION__" }),
    "package.json": MANIFEST({ name: "@noldova/teamrun" }),
    "src/package.json": MANIFEST({ name: "@noldova/teamrun.angular" }),
    "app/package.json": MANIFEST({ name: "teamrun-app", dependencies: { "@noldova/teamrun": "0.0.2", "@noldova/terminal": "0.0.2" } }),
    "app/src/noldova.teamrun.window.app/package.json": MANIFEST({ name: "teamrun-app-window" }),
    "package-lock.json": MANIFEST({ name: "@noldova/teamrun", lockfileVersion: 3, packages: {
      "": { name: "@noldova/teamrun", version: "0.0.2", dependencies: { "@noldova/terminal.protocol": "0.0.2" } },
      "node_modules/@noldova/terminal.protocol": { version: "0.0.2", resolved: "https://registry.example/terminal.protocol-0.0.2.tgz" },
      "src": { name: "@noldova/teamrun.angular", version: "0.0.2" }
    } }),
    "app/package-lock.json": MANIFEST({ name: "teamrun-app", lockfileVersion: 3, packages: {
      "": { name: "teamrun-app", version: "0.0.2", dependencies: { "@noldova/teamrun": "0.0.2", "@noldova/terminal": "0.0.2" } },
      "node_modules/@noldova/teamrun": { version: "0.0.2", resolved: "file:../_packages/noldova-teamrun-0.0.2.tgz", dependencies: { "@noldova/teamrun.core": "0.0.2" } },
      "node_modules/@noldova/teamrun.core": { version: "0.0.2", resolved: "file:../_packages/noldova-teamrun.core-0.0.2.tgz" },
      "node_modules/@noldova/terminal": { version: "0.0.2", resolved: "https://registry.example/terminal-0.0.2.tgz" },
      "src/noldova.teamrun.window.app": { name: "teamrun-app-window", version: "0.0.2" }
    } })
  };
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return root;
};

const read = (root: string, file: string): string => readFileSync(path.join(root, file), "utf8");
const readJson = (root: string, file: string): Record<string, unknown> => JSON.parse(read(root, file));

describe("VersionSetter", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("sets the version in every file that holds it and the archives' names, and leaves other packages' pins alone", async () => {
    const root = createRoot();

    assert.equal(await new VersionSetter(root).setAsync("0.0.3", null), "0.0.2");

    assert.equal(read(root, "version.json"), "{ \"version\": \"0.0.3\" }\n");
    assert.equal(read(root, "src/noldova.teamrun/module.json"), "{\n  \"id\": \"teamrun\",\n  \"version\": \"0.0.3\",\n  \"dependencies\": { \"terminal\": \"0.0.2\" }\n}\n");
    for (const file of ["package.json", "src/package.json", "app/package.json", "app/src/noldova.teamrun.window.app/package.json"])
      assert.equal(readJson(root, file)["version"], "0.0.3", file);
    assert.deepEqual(readJson(root, "app/package.json")["dependencies"], { "@noldova/teamrun": "0.0.3", "@noldova/terminal": "0.0.2" });
    assert.equal(readJson(root, "src/noldova.teamrun.core/package.json")["version"], "__VERSION__");
    assert.deepEqual(readJson(root, "package-lock.json"), JSON.parse(MANIFEST({ name: "@noldova/teamrun", version: "0.0.3", lockfileVersion: 3, packages: {
      "": { name: "@noldova/teamrun", version: "0.0.3", dependencies: { "@noldova/terminal.protocol": "0.0.2" } },
      "node_modules/@noldova/terminal.protocol": { version: "0.0.2", resolved: "https://registry.example/terminal.protocol-0.0.2.tgz" },
      "src": { name: "@noldova/teamrun.angular", version: "0.0.3" }
    } })));
    assert.deepEqual(readJson(root, "app/package-lock.json"), JSON.parse(MANIFEST({ name: "teamrun-app", version: "0.0.3", lockfileVersion: 3, packages: {
      "": { name: "teamrun-app", version: "0.0.3", dependencies: { "@noldova/teamrun": "0.0.3", "@noldova/terminal": "0.0.2" } },
      "node_modules/@noldova/teamrun": { version: "0.0.3", resolved: "file:../_packages/noldova-teamrun-0.0.3.tgz", dependencies: { "@noldova/teamrun.core": "0.0.3" } },
      "node_modules/@noldova/teamrun.core": { version: "0.0.3", resolved: "file:../_packages/noldova-teamrun.core-0.0.3.tgz" },
      "node_modules/@noldova/terminal": { version: "0.0.2", resolved: "https://registry.example/terminal-0.0.2.tgz" },
      "src/noldova.teamrun.window.app": { name: "teamrun-app-window", version: "0.0.3" }
    } })));
    assert.equal(read(root, "CHANGELOG.md"),
      `${PREFACE}\n## Unreleased\n\n## 0.0.3\n\n### Fixed\n\n- **First fix:** it works.\n  In 0.0.2 it didn't.\n- **Second fix:** it works too.\n\n### Added\n\n- **A feature:** new.\n\n${OLDER}`);
  });

  it("names the version over only the entries a release's commit held, and keeps later ones unreleased under their heading", () => {
    const all = VersionSetter.release(CHANGELOG, "0.0.3", CHANGELOG);
    const released = `${PREFACE}\n## Unreleased\n\n### Fixed\n\n- **First fix:** it works.\n  In 0.0.2 it didn't.\n\n${OLDER}`;

    const changelog = VersionSetter.release(CHANGELOG, "0.0.3", released);

    assert.equal(changelog, `${PREFACE}\n## Unreleased\n\n### Fixed\n\n- **Second fix:** it works too.\n\n### Added\n\n- **A feature:** new.\n\n`
      + `## 0.0.3\n\n### Fixed\n\n- **First fix:** it works.\n  In 0.0.2 it didn't.\n\n${OLDER}`);
    assert.equal(all, `${PREFACE}\n## Unreleased\n\n## 0.0.3\n\n### Fixed\n\n- **First fix:** it works.\n  In 0.0.2 it didn't.\n- **Second fix:** it works too.\n\n### Added\n\n- **A feature:** new.\n\n${OLDER}`);
  });

  it("refuses a changelog without an unreleased section, or whose section the release holds nothing of, and writes nothing", async () => {
    const root = createRoot(`${PREFACE}\n${OLDER}`);

    await assert.rejects(new VersionSetter(root).setAsync("0.0.3", null), new SetVersionException("CHANGELOG.md has no \"## Unreleased\" section, so 0.0.3 would release nothing it names."));
    assert.throws(() => VersionSetter.release(CHANGELOG, "0.0.3", `${PREFACE}\n${OLDER}`), new SetVersionException("The \"## Unreleased\" section of CHANGELOG.md names nothing 0.0.3 releases."));
    assert.throws(() => VersionSetter.release(`${PREFACE}\n## Unreleased\n\n\n${OLDER}`, "0.0.3", null), new SetVersionException("The \"## Unreleased\" section of CHANGELOG.md names nothing 0.0.3 releases."));
    assert.equal(read(root, "version.json"), "{ \"version\": \"0.0.2\" }\n");
  });

  it("refuses a version that isn't major.minor.patch or isn't newer, and a module file that doesn't hold the current version once", async () => {
    const root = createRoot();
    writeFileSync(path.join(root, "src/noldova.teamrun/module.json"), "{ \"version\": \"0.0.1\" }\n");

    await assert.rejects(new VersionSetter(root).setAsync("0.0.3-beta", null), new SetVersionException("The version must be major.minor.patch, such as 0.0.3, not \"0.0.3-beta\"."));
    for (const older of ["0.0.2", "0.0.1", "0.0.0"])
      await assert.rejects(new VersionSetter(root).setAsync(older, null), new SetVersionException(`${older} isn't newer than version.json's 0.0.2.`));
    await assert.rejects(new VersionSetter(root).setAsync("0.0.3", null), new SetVersionException("src/noldova.teamrun/module.json must hold \"version\": \"0.0.2\" once."));
    assert.equal(read(root, "version.json"), "{ \"version\": \"0.0.2\" }\n");
    assert.equal(read(root, "CHANGELOG.md"), CHANGELOG);
  });
});

describe("SetVersion", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  const runAsync = async (root: string, args: readonly string[], readCommitFile: (commit: string, file: string) => string = () => ""): Promise<{ exitCode: number, output: string }> => {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await new SetVersion(root, output, readCommitFile).runAsync(args);
    return { exitCode, output: chunks.join("") };
  };

  it("sets the version and says what it named, from the released commit's changelog when it names one", async () => {
    const root = createRoot();
    const reads: string[] = [];

    const result = await runAsync(root, ["0.0.3", COMMIT], (commit, file) => {
      reads.push(`${commit}:${file}`);
      return CHANGELOG;
    });

    assert.deepEqual([result.exitCode, result.output, reads], [0, `Set the version from 0.0.2 to 0.0.3, and named it over the changelog's entries that ${COMMIT} released.\n`, [`${COMMIT}:CHANGELOG.md`]]);
    assert.equal(read(root, "version.json"), "{ \"version\": \"0.0.3\" }\n");
  });

  it("answers missing, extra or malformed arguments with its usage, and a refusal with its reason", async () => {
    const root = createRoot(`${PREFACE}\n${OLDER}`);
    const usage = "Usage: npm run set-version -- <major.minor.patch> [<released commit>]\n";

    assert.deepEqual(await runAsync(root, []), { exitCode: 2, output: usage });
    assert.deepEqual(await runAsync(root, ["0.0.3", "main"]), { exitCode: 2, output: usage });
    assert.deepEqual(await runAsync(root, ["0.0.3", COMMIT, "more"]), { exitCode: 2, output: usage });
    assert.deepEqual(await runAsync(root, ["0.0.3"]), { exitCode: 1, output: "CHANGELOG.md has no \"## Unreleased\" section, so 0.0.3 would release nothing it names.\n" });
  });
});
