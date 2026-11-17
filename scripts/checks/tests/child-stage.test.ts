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
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { ProcessRunner } from "../../processes/process-runner.ts";
import { ChildStage } from "../child-stage.ts";

const folders: string[] = [];
const TITLES: readonly string[] = ["Documents", "Concept files"];

const stageIn = (script: string, limit: number = 60_000): { stage: ChildStage; results: string; log: string } => {
  const root = mkdtempSync(path.join(tmpdir(), "child-stage-"));
  folders.push(root);
  const file = path.join(root, "stage.mjs");
  writeFileSync(file, script);
  const results = path.join(root, "_build", "results.json");
  const log = path.join(root, "_build", "stage.log");
  return { results, log, stage: new ChildStage(root, new ProcessRunner(), file, results, log, limit) };
};

const runAsync = async (stage: ChildStage): Promise<{ results: readonly boolean[]; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const results = await stage.runAsync(TITLES, output);
  return { results, text };
};

const writing = (results: string): string => `import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], ${JSON.stringify(results)});\n`;

const ended = (how: string): string => `The 2 checks ran in a process of their own, which ${how}; its output is above and in ${path.join("_build", "stage.log")}.\n`;
const NO_RESULTS: string = ended("ended with exit code 0 without their results");
const FAILED: string = ended("ended with exit code 1, so their results don't count");

describe("ChildStage", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("gives the results its process wrote, and passes the process's output on and keeps it in its log", async () => {
    const { stage, log } = stageIn(`process.stdout.write("Documents: passed\\n");\n${writing("[true,false]")}`);

    const { results, text } = await runAsync(stage);

    assert.deepEqual(results, [true, false]);
    assert.equal(text, "Documents: passed\n");
    assert.equal(readFileSync(log, "utf8"), "Documents: passed\n");
  });

  it("fails every check, after the process's own output and with its exit code, when the process fails", async () => {
    const { stage } = stageIn("process.stderr.write(\"The API server stopped.\\n\");\nprocess.exitCode = 3;\n");

    const { results, text } = await runAsync(stage);

    assert.deepEqual(results, [false, false]);
    assert.match(text, /^The API server stopped\.\n/);
    assert.ok(text.endsWith(ended("ended with exit code 3, so their results don't count")));
  });

  it("fails every check when its process fails after writing results, or ends without writing them over an earlier run's", async () => {
    const failing = stageIn(`${writing("[true,true]")}process.exitCode = 1;\n`);
    const leaving = stageIn("process.exitCode = 0;\n");
    mkdirSync(path.dirname(leaving.results), { recursive: true });
    writeFileSync(leaving.results, "[true,true]");

    const found = [await runAsync(failing.stage), await runAsync(leaving.stage)];

    assert.deepEqual(found.map(t => t.results), [[false, false], [false, false]]);
    assert.deepEqual(found.map(t => t.text), [FAILED, NO_RESULTS]);
  });

  it("fails every check when the results aren't one true or false for each check", async () => {
    const found = await Promise.all(["[true]", "[true,\"yes\"]", "{}", "not JSON"].map(async t => await runAsync(stageIn(writing(t)).stage)));

    assert.deepEqual(found.map(t => t.results), [[false, false], [false, false], [false, false], [false, false]]);
    assert.deepEqual(found.map(t => t.text), [NO_RESULTS, NO_RESULTS, NO_RESULTS, NO_RESULTS]);
  });

  it("names the signal or exit code its process was killed with, and fails every check even when it wrote their results first", async () => {
    const { stage } = stageIn(`${writing("[true,true]")}process.kill(process.pid, "SIGKILL");\n`);

    const { results, text } = await runAsync(stage);

    assert.deepEqual(results, [false, false]);
    assert.equal(text, process.platform === "win32" ? FAILED : ended("ended on signal SIGKILL, so their results don't count"));
  });

  it("stops its process at its limit, fails every check and says so, and returns once the process has exited", async () => {
    const { stage } = stageIn("process.stdout.write(`pid ${process.pid}\\n`);\nsetInterval(() => undefined, 1000);\n", 5000);

    const { results, text } = await runAsync(stage);

    assert.deepEqual(results, [false, false]);
    assert.ok(text.endsWith(ended("was stopped at its limit of 5 s")));
    const pid = Number(/pid (\d+)/.exec(text)?.[1]);
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  });

  it("returns only once its process has exited, so the next stage starts without it", async () => {
    const { stage } = stageIn(`${writing("[true,true]")}process.stdout.write(\`pid \${process.pid}\\n\`);\nconst until = Date.now() + 300;\nwhile (Date.now() < until);\nprocess.stdout.write("leaving\\n");\n`);

    const { results, text } = await runAsync(stage);

    assert.deepEqual(results, [true, true]);
    assert.match(text, /leaving\n$/);
    const pid = Number(/pid (\d+)/.exec(text)?.[1]);
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  });
});
