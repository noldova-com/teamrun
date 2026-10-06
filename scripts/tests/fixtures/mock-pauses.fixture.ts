/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import HangLimitFixture from "./hang-limit.fixture.ts";
import type TextOutputFixture from "./text-output.fixture.ts";

export default class MockPausesFixture {
  public static readonly PAUSE: number = 15_000;

  private static readonly LIMIT: number = 20_000;

  public static async settleAsync(t: TestContext, start: () => Promise<void>, output: TextOutputFixture, describe: () => string): Promise<void> {
    const limit = new HangLimitFixture(MockPausesFixture.LIMIT);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = start();
      const settled = run.then(() => {
        isDone = true;
      }, () => {
        isDone = true;
      });
      while (!isDone) {
        await Promise.race([settled, output.nextWriteAsync(), limit.passed]);
        assert.ok(isDone || !limit.isPassed, `the run did not settle within ${limit.milliseconds} ms; ${describe()}`);
        t.mock.timers.tick(MockPausesFixture.PAUSE);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
      limit.stop();
    }
  }

  public static async stepAsync(t: TestContext, start: () => Promise<void>, output: TextOutputFixture, pausing: (attempt: number) => string, attempts: () => number, failures: number): Promise<void> {
    const limit = new HangLimitFixture(MockPausesFixture.LIMIT);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const run = start();
      for (let failed = 1; failed <= failures; failed++) {
        while (!output.text.includes(pausing(failed))) {
          await Promise.race([output.nextWriteAsync(), limit.passed]);
          assert.ok(!limit.isPassed, `no pause after attempt ${failed} within ${limit.milliseconds} ms; the output is ${JSON.stringify(output.text)}`);
        }
        t.mock.timers.tick(MockPausesFixture.PAUSE - 1);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(attempts(), failed);
        t.mock.timers.tick(1);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
      limit.stop();
    }
  }
}
