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

const runWith = async (stage: string): Promise<{ exitCode: number; text: string }> => {
  const root = mkdtempSync(path.join(tmpdir(), "reading-stage-"));
  folders.push(root);
  mkdirSync(path.join(root, "scripts"));
  writeFileSync(path.join(root, "scripts", "reading-stage.ts"), stage);
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const exitCode = await new Test(root, new ProcessRunner(), output, {}).runAsync([]);
  return { exitCode, text };
};

describe("npm test's checks that read", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("run in a process of their own, and when it fails the run fails with its output and stops before the checks that build", async () => {
    const { exitCode, text } = await runWith("process.stderr.write(\"The API server stopped.\\n\");\nprocess.exitCode = 2;\n");

    assert.equal(exitCode, 1);
    assert.match(text, /^The API server stopped\.\n/);
    assert.match(text, /The \d+ checks ran in a process of their own, which ended with exit code 2, so their results don't count; its output is above and in _build[\\/]reading-checks\.log\./);
    assert.match(text, /\nStopped before the \d+ checks that build, compile or run tests, because a check above failed: Angular cdk copy rules, Packages,/);
    assert.match(text, /\n0 of \d+ checks passed\.\n$/);
  });
});
