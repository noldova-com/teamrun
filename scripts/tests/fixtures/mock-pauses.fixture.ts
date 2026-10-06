/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import type TextOutputFixture from "./text-output.fixture.ts";

export default class MockPausesFixture {
  public static readonly PAUSE: number = 15_000;

  private static readonly POLLS: number = 1_000;

  public static async settleAsync(t: TestContext, start: () => Promise<void>, describe: () => string): Promise<void> {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = start();
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      for (let poll = 0; !isDone; poll++) {
        assert.ok(poll < MockPausesFixture.POLLS, `the run did not settle; ${describe()}`);
        await new Promise(resolve => setImmediate(resolve));
        t.mock.timers.tick(MockPausesFixture.PAUSE);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
    }
  }

  public static async stepAsync(t: TestContext, start: () => Promise<void>, output: TextOutputFixture, pausing: (attempt: number) => string, attempts: () => number, failures: number): Promise<void> {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const run = start();
      for (let failed = 1; failed <= failures; failed++) {
        for (let poll = 0; !output.text.includes(pausing(failed)); poll++) {
          assert.ok(poll < MockPausesFixture.POLLS, `no pause after attempt ${failed}; the output is ${JSON.stringify(output.text)}`);
          await new Promise(resolve => setImmediate(resolve));
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
    }
  }
}
