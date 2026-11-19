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

import { ProcessRunner } from "../../processes/process-runner.ts";
import { Test } from "../../test.ts";

const folders: string[] = [];

const runWith = async (args: readonly string[], environment: NodeJS.ProcessEnv): Promise<{ exitCode: number; text: string }> => {
  const root = mkdtempSync(path.join(tmpdir(), "separate-test-"));
  folders.push(root);
  mkdirSync(path.join(root, "scripts"));
  writeFileSync(path.join(root, "scripts", "reading-stage.ts"), "process.exitCode = 2;\n");
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const exitCode = await new Test(root, new ProcessRunner(), output, environment).runAsync(args);
  return { exitCode, text };
};

const stoppedOf = (text: string): string => /\nStopped before the \d+ checks that build, compile or run tests, because a check above failed: (.+)\.\n/.exec(text)?.[1] ?? "";

describe("npm test's Angular tests in a job of their own", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("are left out of the run when NOLDOVA_SEPARATE_TEST is angular, and kept in it otherwise", async () => {
    const separate = await runWith([], { NOLDOVA_SEPARATE_TEST: "angular" });
    const whole = await runWith([], { NOLDOVA_SEPARATE_TEST: "" });

    assert.equal(stoppedOf(separate.text), "Angular cdk copy rules, Packages, Same archives, Copy list, Package tests and coverage, Script types, Script tests");
    assert.equal(stoppedOf(whole.text), "Angular cdk copy rules, Packages, Same archives, Copy list, Package tests and coverage, Angular tests and coverage, Failure screenshots, Script types, Script tests");
  });

  it("takes the skip options the shared build-and-test workflow passes, and runs the same checks", async () => {
    const { exitCode, text } = await runWith(["--skip-test-details", "--skip-coverage-details"], { NOLDOVA_SEPARATE_TEST: "angular" });

    assert.equal(exitCode, 1);
    assert.doesNotMatch(text, /Usage: npm test/u);
    assert.equal(stoppedOf(text), "Angular cdk copy rules, Packages, Same archives, Copy list, Package tests and coverage, Script types, Script tests");
  });

  it("refuses a NOLDOVA_SEPARATE_TEST other than angular before any check runs", async () => {
    const { exitCode, text } = await runWith([], { NOLDOVA_SEPARATE_TEST: "docs" });

    assert.equal(exitCode, 2);
    assert.equal(text, "NOLDOVA_SEPARATE_TEST names the tests that run in a job of their own, which npm test leaves out; it takes only angular, not \"docs\".\n"
      + "Usage: npm test [-- documents | angular | [--filter <text>]... [--repeat <count>] [--rerun-failed] [--skip-test-details] [--skip-coverage-details]]\n");
  });

  it("refuses angular with another option", async () => {
    const { exitCode, text } = await runWith(["angular", "--rerun-failed"], {});

    assert.equal(exitCode, 2);
    assert.match(text, /^angular takes no other option\.\nUsage: npm test /);
  });
});
