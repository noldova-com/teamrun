/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import "@noldova/context.core";

import { ProcessRunner } from "../../processes/process-runner.ts";
import { Git } from "../../repository/git.ts";
import { RepositoryFiles } from "../../repository/repository-files.ts";
import { DependencyPinCheck } from "../dependency-pin-check.ts";

const folders: string[] = [];

const RUNTIME = "@noldova/desktop.runtime";
const CONTEXT = "@noldova/context.core";
const KIT = "@noldova/ui.components.angular";
const TERMINAL = "@noldova/terminal.protocol";
const DECLARATION = "src/noldova.teamrun/module.json";
const PART = "src/noldova.teamrun.runtime/package.json";
const WINDOW = "src/noldova.teamrun.window/package.json";
const ANGULAR = "@angular/core";

const write = (root: string, file: string, text: string): void => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};

const repositoryAsync = async (sample: {
  readonly noldovaDesktop?: unknown;
  readonly peers?: Readonly<Record<string, string>>;
  readonly shipped?: Readonly<Record<string, string>>;
  readonly pins?: Readonly<Record<string, string>>;
  readonly locks?: Readonly<Record<string, string>>;
  readonly nested?: Readonly<Record<string, string>>;
  readonly angular?: string;
} = {}): Promise<string> => {
  const root = mkdtempSync(path.join(tmpdir(), "dependency-pins-"));
  folders.push(root);
  await new Git(root, new ProcessRunner()).readOutputAsync(["init", "--quiet"]);
  const pins = sample.pins ?? { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62" };
  const locks = sample.locks ?? pins;
  write(root, "package.json", JSON.stringify({ name: "@noldova/teamrun", version: "0.0.2", private: true, dependencies: pins }));
  write(root, "package-lock.json", JSON.stringify({ packages: Object.fromEntries([...Object.entries(locks).map(([name, version]) => [`node_modules/${name}`, { version }]),
    ...Object.entries(sample.nested ?? {}).map(([name, version]) => [`src/node_modules/${name}`, { version }])]) }));
  if (!Object.isUndefined(sample.angular)) {
    write(root, "src/package.json", JSON.stringify({ name: "@noldova/teamrun.angular", private: true, dependencies: { [ANGULAR]: sample.angular } }));
    write(root, WINDOW, JSON.stringify({ name: "@noldova/teamrun.window", version: "__VERSION__", peerDependencies: { [ANGULAR]: sample.angular } }));
  }
  write(root, ".npmrc", "save-exact=true\n");
  write(root, PART, JSON.stringify({ name: "@noldova/teamrun.runtime", version: "__VERSION__", dependencies: sample.shipped ?? {},
    peerDependencies: sample.peers ?? { [RUNTIME]: ">=0.0.72 <0.1.0", [CONTEXT]: ">=0.0.2 <0.1.0", [TERMINAL]: "0.0.62" } }));
  write(root, DECLARATION, JSON.stringify("noldovaDesktop" in sample ? { id: "teamrun", noldovaDesktop: sample.noldovaDesktop } : { id: "teamrun", noldovaDesktop: ">=0.0.72 <0.1.0" }));
  return root;
};

const runAsync = async (sample: Parameters<typeof repositoryAsync>[0] = {}): Promise<{ passed: boolean; text: string }> => {
  const root = await repositoryAsync(sample);
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const passed = await new DependencyPinCheck(root, new RepositoryFiles(root, new Git(root, new ProcessRunner()))).runAsync(output);
  return { passed, text };
};

describe("DependencyPinCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("passes a module whose noldovaDesktop runs to the next minor, whose Noldova Desktop peers take it and whose ranges include the root's pins", async () => {
    const { passed, text } = await runAsync();

    assert.equal(passed, true, text);
    assert.match(text, /3 shipped versions against their pins and locks, the npm configuration of 1 lockfiles and the Noldova Desktop range of 1 module declarations\./);
  });

  it("passes a noldovaDesktop from 1.0 that runs to the next major", async () => {
    const { passed, text } = await runAsync({ noldovaDesktop: ">=1.2.0 <2.0.0", peers: { [RUNTIME]: ">=1.2.0 <2.0.0" }, pins: { [RUNTIME]: "1.2.5" } });

    assert.equal(passed, true, text);
  });

  for (const noldovaDesktop of [undefined, 72, ">=0.0.72 <0.2.0", ">=1.2.0 <1.3.0", "^0.0.72", ">=0.0.72", ">=0.1.0 <0.1.0", ">=0.0.72 <0.1.0 "])
    it(`fails a noldovaDesktop of ${Object.isUndefined(noldovaDesktop) ? "nothing" : JSON.stringify(noldovaDesktop)}, which isn't the one range a module writes`, async () => {
      const { passed, text } = await runAsync({ noldovaDesktop, peers: { [RUNTIME]: "0.0.72" } });

      assert.equal(passed, false);
      assert.match(text, new RegExp(`^${DECLARATION}: noldovaDesktop is ${Object.isUndefined(noldovaDesktop) ? "missing" : ""}`, "m"));
      assert.doesNotMatch(text, /a peer on Noldova Desktop's packages takes/);
    });

  it("fails a peer on Noldova Desktop's packages at an exact version rather than noldovaDesktop", async () => {
    const { passed, text } = await runAsync({ peers: { [RUNTIME]: "0.0.72", [CONTEXT]: ">=0.0.2 <0.1.0" } });

    assert.equal(passed, false);
    assert.equal(text.split("\n").filter(t => t.startsWith(PART)).join("\n"),
      `${PART}: peerDependencies ${RUNTIME} is "0.0.72"; a peer on Noldova Desktop's packages takes ${DECLARATION}'s noldovaDesktop, ">=0.0.72 <0.1.0".`);
  });

  it("fails a range on a peer outside Noldova Desktop's, context's and the kit's packages, and on a dependency", async () => {
    const { passed, text } = await runAsync({ peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [TERMINAL]: ">=0.0.62 <0.1.0" }, pins: { [RUNTIME]: "0.0.72", [CONTEXT]: ">=0.0.2 <0.1.0" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${TERMINAL} is ">=0.0.62 <0.1.0", which is not an exact version`, "m"));
    assert.match(text, new RegExp(`^package.json: dependencies ${CONTEXT} is ">=0.0.2 <0.1.0", which is not an exact version`, "m"));
  });

  it("fails a peer on a shared package at another range form", async () => {
    const { passed, text } = await runAsync({ peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [CONTEXT]: "^0.0.2" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${CONTEXT} is "\\^0.0.2", which is not a range of the form >=<lowest> <first refused>`, "m"));
  });

  it("fails a shared package among a TeamRun package's dependencies, naming a range for context's and the kit's and the module's noldovaDesktop range for Noldova Desktop's", async () => {
    const { passed, text } = await runAsync({ shipped: { [CONTEXT]: "0.0.2", [RUNTIME]: "0.0.72" } });

    assert.equal(passed, false);
    const lines = text.split("\n").filter(t => t.startsWith(`${PART}: dependencies`));
    assert.deepEqual(lines, [
      `${PART}: dependencies ${CONTEXT} is a package Noldova Desktop shares with every module; it goes in peerDependencies as a range of the form `
        + ">=<lowest> <first refused>, from a tested version to the next minor below 1.0, or the next major from 1.0, since Noldova Desktop's build refuses an app "
        + "whose module brings its own copy.",
      `${PART}: dependencies ${RUNTIME} is a package Noldova Desktop shares with every module; it goes in peerDependencies at the module's noldovaDesktop range, `
        + "since Noldova Desktop's build refuses an app whose module brings its own copy."
    ]);
  });

  for (const [shared, pin] of [[CONTEXT, "0.0.2"], [KIT, "0.0.97"]] as const)
    it(`fails an exact peer on ${shared}, which takes a range so a release of its own reaches TeamRun with one pin change`, async () => {
      const { passed, text } = await runAsync({ peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [shared]: pin },
        pins: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62", [KIT]: "0.0.97" } });

      assert.equal(passed, false);
      assert.equal(text.split("\n").filter(t => t.startsWith(PART)).join("\n"),
        `${PART}: peerDependencies ${shared} is "${pin}", which is not a range of the form >=<lowest> <first refused> that ends at the next minor below 1.0, `
        + "or the next major from 1.0; a peer on context's or the kit's packages takes one, from the version it builds against, such as >=0.1.2 <0.2.0 "
        + "or >=1.2.3 <2.0.0, so their release inside it reaches TeamRun with one pin change.");
    });

  for (const range of [">=0.0.2 <0.0.3", ">=0.0.1 <9.0.0", ">=1.2.3 <1.3.0"])
    it(`fails a peer range of ${range} on a shared package, which doesn't end at the next minor below 1.0 or the next major from 1.0`, async () => {
      const { passed, text } = await runAsync({ peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [CONTEXT]: range } });

      assert.equal(passed, false);
      assert.match(text, new RegExp(`^${PART}: peerDependencies ${CONTEXT} is "${range}", which is not a range of the form`, "m"));
    });

  it("passes a peer range on a shared package from below the root's pin, which a pin move inside the range leaves as it is", async () => {
    const { passed, text } = await runAsync({ peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [CONTEXT]: ">=0.0.1 <0.1.0" } });

    assert.equal(passed, true, text);
  });

  it("fails a peer range on context's or the kit's packages that starts more than one version below the root's pin", async () => {
    const pins = { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.7", [TERMINAL]: "0.0.62" };

    const { passed, text } = await runAsync({ pins });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${CONTEXT} is ">=0.0.2 <0.1.0", but the root package.json pins "0.0.7"; a peer on context's or the kit's packages starts from the version`, "m"));
  });

  for (const lowest of ["0.0.6", "0.0.7"])
    it(`passes a peer range on context's or the kit's packages from ${lowest} with the root's pin at 0.0.7`, async () => {
      const { passed, text } = await runAsync({ pins: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.7", [TERMINAL]: "0.0.62" },
        peers: { [RUNTIME]: ">=0.0.72 <0.1.0", [CONTEXT]: `>=${lowest} <0.1.0`, [TERMINAL]: "0.0.62" } });

      assert.equal(passed, true, text);
    });

  it("leaves a peer on Noldova Desktop's packages to noldovaDesktop however far below the root's pin it starts", async () => {
    const { passed, text } = await runAsync({ noldovaDesktop: ">=0.0.2 <0.1.0", pins: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62" },
      peers: { [RUNTIME]: ">=0.0.2 <0.1.0", [CONTEXT]: ">=0.0.2 <0.1.0", [TERMINAL]: "0.0.62" } });

    assert.equal(passed, true, text);
  });

  it("fails a range that leaves out the version the root pins", async () => {
    const { passed, text } = await runAsync({ pins: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.1.0", [TERMINAL]: "0.0.62" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${CONTEXT} is ">=0.0.2 <0.1.0", but the root package.json pins "0.1.0", outside it`, "m"));
  });

  it("fails a range whose package the root doesn't pin", async () => {
    const { passed, text } = await runAsync({ pins: { [RUNTIME]: "0.0.72", [TERMINAL]: "0.0.62" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${CONTEXT} is ">=0.0.2 <0.1.0", but the root package.json pins nothing`, "m"));
  });

  it("holds the root lockfile to the root's pin, not to the range around it", async () => {
    const { passed, text } = await runAsync({ locks: { [RUNTIME]: "0.0.73", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${PART}: peerDependencies ${RUNTIME} is ">=0.0.72 <0.1.0", but the root package-lock.json locks version 0.0.73 of it`, "m"));
  });

  it("holds an Angular package's peers to src/'s pins and to the copy the root lockfile hoists", async () => {
    const { passed, text } = await runAsync({ angular: "22.2.6", locks: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62", [ANGULAR]: "22.2.6" } });

    assert.equal(text.split("\n").filter(t => t.startsWith(WINDOW)).join("\n"), "");
    assert.equal(passed, true);
  });

  it("holds an Angular package's peers to the copy the root lockfile nests under src/ before the hoisted one", async () => {
    const { passed, text } = await runAsync({ angular: "22.2.6", locks: { [RUNTIME]: "0.0.72", [CONTEXT]: "0.0.2", [TERMINAL]: "0.0.62", [ANGULAR]: "22.2.6" }, nested: { [ANGULAR]: "22.2.5" } });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${WINDOW}: peerDependencies ${ANGULAR} is "22.2.6", but the root package-lock.json locks version 22.2.5 of it`, "m"));
  });

  it("fails an Angular package's peer that the root lockfile doesn't lock", async () => {
    const { passed, text } = await runAsync({ angular: "22.2.6" });

    assert.equal(passed, false);
    assert.match(text, new RegExp(`^${WINDOW}: peerDependencies ${ANGULAR} is "22.2.6", but the root package-lock.json locks no version of it`, "m"));
  });
});
