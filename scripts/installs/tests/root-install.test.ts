/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { RootInstall } from "../root-install.ts";

const folders: string[] = [];

const createRoot = (): { root: string; npm: string; record: string } => {
  const folder = mkdtempSync(path.join(tmpdir(), "root-install-"));
  folders.push(folder);
  const root = path.join(folder, "root");
  mkdirSync(root);
  const record = path.join(folder, "npm-call.json");
  const npm = path.join(folder, "npm-cli.js");
  writeFileSync(npm, `require("node:fs").writeFileSync(${JSON.stringify(record)}, JSON.stringify({ values: process.argv.slice(2), directory: process.cwd() }));\n`
    + "process.exitCode = Number(process.env.FAKE_NPM_EXIT_CODE ?? 0);\n");
  return { root, npm, record };
};

const runAsync = async (root: string, environment: NodeJS.ProcessEnv): Promise<{ exitCode: number; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const exitCode = await new RootInstall(root, environment, output).runAsync();
  return { exitCode, text };
};

describe("RootInstall", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("runs npm ci with install scripts off in the root when the root has no node_modules", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, text } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_EXIT_CODE: "0" });

    assert.equal(exitCode, 0);
    assert.equal(text, "The root has no node_modules, so npm ci installs the root's and src/'s packages first, with install scripts off.\n");
    const call = JSON.parse(readFileSync(record, "utf8"));
    assert.deepEqual(call.values, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    assert.equal(realpathSync(call.directory), realpathSync(root));
  });

  it("returns npm ci's exit code when the install fails", async () => {
    const { root, npm } = createRoot();

    const { exitCode } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_EXIT_CODE: "3" });

    assert.equal(exitCode, 3);
  });

  it("runs nothing when the root already has node_modules", async () => {
    const { root, npm, record } = createRoot();
    mkdirSync(path.join(root, "node_modules"));

    const { exitCode, text } = await runAsync(root, { ...process.env, npm_execpath: npm });

    assert.equal(exitCode, 0);
    assert.equal(text, "");
    assert.equal(existsSync(record), false);
  });

  it("fails with a reason when npm_execpath is not set", async () => {
    const { root, record } = createRoot();
    const environment = { ...process.env };
    delete environment["npm_execpath"];

    const { exitCode, text } = await runAsync(root, environment);

    assert.equal(exitCode, 1);
    assert.equal(text, "The root has no node_modules and npm_execpath is not set; run npm run build, which installs the packages through npm.\n");
    assert.equal(existsSync(record), false);
  });

  it("rejects when npm can't start in the root", async () => {
    const { root, npm, record } = createRoot();
    const missing = path.join(root, "missing");

    await assert.rejects(runAsync(missing, { ...process.env, npm_execpath: npm }), { code: "ENOENT" });
    assert.equal(existsSync(record), false);
  });
});
