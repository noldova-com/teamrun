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
  writeFileSync(npm, [
    "const fs = require(\"node:fs\");",
    "const path = require(\"node:path\");",
    `const record = ${JSON.stringify(record)};`,
    "const calls = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, \"utf8\")) : [];",
    "calls.push({ values: process.argv.slice(2), directory: process.cwd(), logs: process.env.npm_config_logs_dir });",
    "fs.writeFileSync(record, JSON.stringify(calls));",
    "const results = JSON.parse(process.env.FAKE_NPM_RESULTS ?? '[{\"exitCode\":0}]');",
    "const result = results[Math.min(calls.length, results.length) - 1];",
    "fs.writeFileSync(path.join(process.env.npm_config_logs_dir, \"2026-11-20T00_00_00_000Z-debug-0.log\"), (result.log ?? []).join(\"\\n\"));",
    "process.exitCode = result.exitCode;"
  ].join("\n"));
  return { root, npm, record };
};

const REQUESTS: readonly string[] = Array.from({ length: 7 }, (_, t) => `${t + 1} http fetch GET 200 https://registry.npmjs.org/package-${t}/-/package-${t}-1.0.0.tgz 12ms (cache miss)`);
const STALLED: readonly string[] = [...REQUESTS, "8 error code ETIMEDOUT", "9 error syscall read", "10 error errno -60"];
const ABORTED: readonly string[] = [...REQUESTS, "8 error code ECONNRESET", "9 error network aborted"];
const CONNECTING: readonly string[] = [...REQUESTS, "8 error code ETIMEDOUT", "9 error syscall connect", "10 error errno -60"];
const OTHER: readonly string[] = [...REQUESTS, "8 error code EINTEGRITY", "9 error syscall read"];

const readCalls = (record: string): { values: string[]; directory: string; logs: string }[] => JSON.parse(readFileSync(record, "utf8"));

const runAsync = async (root: string, environment: NodeJS.ProcessEnv, isWithScripts: boolean = false): Promise<{ exitCode: number; text: string; waits: number[] }> => {
  let text = "";
  const waits: number[] = [];
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const exitCode = await new RootInstall(root, environment, output, isWithScripts, async milliseconds => { waits.push(milliseconds); }).runAsync();
  return { exitCode, text, waits };
};

const results = (...attempts: { exitCode: number; log?: readonly string[] }[]): string => JSON.stringify(attempts);

describe("RootInstall", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("runs npm ci with install scripts off in the root when the root has no node_modules", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, text } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 0 }) });

    assert.equal(exitCode, 0);
    assert.equal(text, "The root has no node_modules, so npm ci installs the root's and src/'s packages first, with install scripts off.\n");
    const [call, ...rest] = readCalls(record);
    assert.deepEqual(rest, []);
    assert.deepEqual(call?.values, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    assert.equal(realpathSync(call?.directory ?? ""), realpathSync(root));
    assert.equal(existsSync(call?.logs ?? ""), false);
  });

  it("returns npm ci's exit code at once when the install fails for another reason than the network", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, text, waits } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 3, log: OTHER }, { exitCode: 0 }) });

    assert.deepEqual([exitCode, readCalls(record).length, waits], [3, 1, []]);
    assert.equal(text.includes("runs once more"), false);
  });

  it("returns npm ci's exit code at once when a connection timed out before any read", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, waits } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 1, log: CONNECTING }, { exitCode: 0 }) });

    assert.deepEqual([exitCode, readCalls(record).length, waits], [1, 1, []]);
  });

  it("runs npm ci once more after a pause when a read stalled, says so with the last requests, and passes when the second try does", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, text, waits } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 1, log: STALLED }, { exitCode: 0 }) });

    const calls = readCalls(record);
    assert.deepEqual([exitCode, calls.length, waits], [0, 2, [5000]]);
    assert.deepEqual(calls.map(t => t.values), [["ci", "--ignore-scripts", "--no-audit", "--no-fund"], ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]]);
    assert.equal(text, "The root has no node_modules, so npm ci installs the root's and src/'s packages first, with install scripts off.\n"
      + "npm ci stopped on a read that stalled or a connection that was reset, which npm doesn't retry, so it runs once more in 5 seconds. Its last requests:\n"
      + REQUESTS.slice(-5).map(t => `${t}\n`).join(""));
  });

  it("fails with the second try's exit code when npm ci stops on the network twice, and tries no third time", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, waits } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 1, log: ABORTED }, { exitCode: 2, log: STALLED }, { exitCode: 0 }) });

    assert.deepEqual([exitCode, readCalls(record).length, waits], [2, 2, [5000]]);
  });

  it("runs npm ci with install scripts on for install:root, though the root has node_modules, and says nothing first", async () => {
    const { root, npm, record } = createRoot();
    mkdirSync(path.join(root, "node_modules"));

    const { exitCode, text } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 0 }) }, true);

    assert.deepEqual([exitCode, text], [0, ""]);
    assert.deepEqual(readCalls(record).map(t => t.values), [["ci", "--no-audit", "--no-fund"]]);
  });

  it("runs install:root's npm ci once more after a pause when a connection was reset, with install scripts on both times", async () => {
    const { root, npm, record } = createRoot();

    const { exitCode, text, waits } = await runAsync(root, { ...process.env, npm_execpath: npm, FAKE_NPM_RESULTS: results({ exitCode: 1, log: ABORTED }, { exitCode: 0 }) }, true);

    assert.deepEqual([exitCode, waits], [0, [5000]]);
    assert.deepEqual(readCalls(record).map(t => t.values), [["ci", "--no-audit", "--no-fund"], ["ci", "--no-audit", "--no-fund"]]);
    assert.equal(text.startsWith("npm ci stopped on a read that stalled or a connection that was reset"), true);
  });

  it("fails install:root with a reason when npm_execpath is not set", async () => {
    const { root, record } = createRoot();
    const environment = { ...process.env };
    delete environment["npm_execpath"];

    const { exitCode, text } = await runAsync(root, environment, true);

    assert.deepEqual([exitCode, text], [1, "npm_execpath is not set; run npm run install:root, which runs npm ci through npm.\n"]);
    assert.equal(existsSync(record), false);
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
