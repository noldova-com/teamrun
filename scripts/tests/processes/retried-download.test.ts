/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ProcessException from "../../processes/process.exception.ts";
import RetriedDownload from "../../processes/retried-download.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class RetriedDownloadTests {
  private static readonly ATTEMPTS: number = 4;
  private static readonly PAUSE: number = 15_000;
  private static readonly POLLS: number = 1_000;

  public static register(): void {
    test("a download that succeeds is tried once, without a pause or a word", async () => {
      const output = new TextOutputFixture();
      let attempts = 0;

      await RetriedDownload.runAsync("The tool", output, () => {
        attempts++;
        return Promise.resolve(null);
      });

      assert.equal(attempts, 1);
      assert.equal(output.text, "");
    });

    test("a failed download is tried again after a pause of 15 seconds, and says so before each pause", async t => {
      const output = new TextOutputFixture();
      const reasons: (string | null)[] = ["exit code 1: reset", "exit code 1: reset", null];
      let attempts = 0;

      t.mock.timers.enable({ apis: ["setTimeout"] });
      try {
        const run = RetriedDownload.runAsync("The tool", output, () => {
          attempts++;
          return Promise.resolve(reasons.shift() ?? null);
        });
        for (const failed of [1, 2]) {
          await RetriedDownloadTests.waitForPauseAsync(output, failed);
          t.mock.timers.tick(RetriedDownloadTests.PAUSE - 1);
          await new Promise(resolve => setImmediate(resolve));
          assert.equal(attempts, failed);
          t.mock.timers.tick(1);
        }
        await run;
      }
      finally {
        t.mock.timers.reset();
      }

      assert.equal(attempts, 3);
      assert.equal(output.text, `${RetriedDownloadTests.pausing(1)}${RetriedDownloadTests.pausing(2)}`);
    });

    test("a download that fails every time stops after four attempts with the last reason, and pauses between them only", async t => {
      const output = new TextOutputFixture();
      let attempts = 0;

      await assert.rejects(RetriedDownloadTests.runAsync(t, output, () => {
        attempts++;
        return Promise.resolve(`exit code ${attempts}: HTTPError`);
      }), new ProcessException("The tool could not be installed in 4 attempts; the last failed with exit code 4: HTTPError."));

      assert.equal(attempts, RetriedDownloadTests.ATTEMPTS);
      assert.equal(output.text, `${RetriedDownloadTests.pausing(1)}${RetriedDownloadTests.pausing(2)}${RetriedDownloadTests.pausing(3)}`);
    });
  }

  private static pausing(attempt: number): string {
    return `The tool could not be installed (attempt ${attempt} of ${RetriedDownloadTests.ATTEMPTS}); trying again in ${RetriedDownloadTests.PAUSE / 1000} seconds.\n`;
  }

  private static async runAsync(t: TestContext, output: TextOutputFixture, attemptAsync: () => Promise<string | null>): Promise<void> {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = RetriedDownload.runAsync("The tool", output, attemptAsync);
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      for (let poll = 0; !isDone; poll++) {
        assert.ok(poll < RetriedDownloadTests.POLLS, `the download did not settle; the output is ${JSON.stringify(output.text)}`);
        await new Promise(resolve => setImmediate(resolve));
        t.mock.timers.tick(RetriedDownloadTests.PAUSE);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
    }
  }

  private static async waitForPauseAsync(output: TextOutputFixture, attempt: number): Promise<void> {
    const pausing = RetriedDownloadTests.pausing(attempt);
    for (let poll = 0; !output.text.includes(pausing); poll++) {
      assert.ok(poll < RetriedDownloadTests.POLLS, `no pause after attempt ${attempt}; the output is ${JSON.stringify(output.text)}`);
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

RetriedDownloadTests.register();
