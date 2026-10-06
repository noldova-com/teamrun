/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessException from "../../processes/process.exception.ts";
import RetriedDownload from "../../processes/retried-download.ts";
import MockPausesFixture from "../fixtures/mock-pauses.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class RetriedDownloadTests {
  private static readonly ATTEMPTS: number = 4;

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

      await MockPausesFixture.stepAsync(t, () => RetriedDownload.runAsync("The tool", output, () => {
        attempts++;
        return Promise.resolve(reasons.shift() ?? null);
      }), output, RetriedDownloadTests.pausing, () => attempts, 2);

      assert.equal(attempts, 3);
      assert.equal(output.text, `${RetriedDownloadTests.pausing(1)}${RetriedDownloadTests.pausing(2)}`);
    });

    test("a download that fails every time stops after four attempts with the last reason, and pauses between them only", async t => {
      const output = new TextOutputFixture();
      let attempts = 0;

      await assert.rejects(MockPausesFixture.settleAsync(t, () => RetriedDownload.runAsync("The tool", output, () => {
        attempts++;
        return Promise.resolve(`exit code ${attempts}: HTTPError`);
      }), () => `the output is ${JSON.stringify(output.text)}`), new ProcessException("The tool could not be installed in 4 attempts; the last failed with exit code 4: HTTPError."));

      assert.equal(attempts, RetriedDownloadTests.ATTEMPTS);
      assert.equal(output.text, `${RetriedDownloadTests.pausing(1)}${RetriedDownloadTests.pausing(2)}${RetriedDownloadTests.pausing(3)}`);
    });
  }

  private static pausing(attempt: number): string {
    return `The tool could not be installed (attempt ${attempt} of ${RetriedDownloadTests.ATTEMPTS}); trying again in ${MockPausesFixture.PAUSE / 1000} seconds.\n`;
  }
}

RetriedDownloadTests.register();
