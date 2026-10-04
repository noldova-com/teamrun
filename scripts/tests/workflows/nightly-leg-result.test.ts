/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import NightlyFailure from "../../workflows/nightly-failure.ts";
import NightlyLegResult from "../../workflows/nightly-leg-result.ts";
import NightlyResultException from "../../workflows/nightly-result.exception.ts";

class NightlyLegResultTests {
  public static register(): void {
    test("a job's result reads back what it wrote", () => {
      const result = new NightlyLegResult("Linux x64, tests", [new NightlyFailure("npm test › Packages", "It failed.", 2)]);

      const read = NightlyLegResult.parse(result.toJson(), "linux-x64-tests.json");

      assert.equal(read.label, "Linux x64, tests");
      assert.deepEqual(read.failures, [new NightlyFailure("npm test › Packages", "It failed.", 2)]);
      assert.ok(result.toJson().endsWith("}\n"));
    });

    test("anything but a job's result is refused with the file's name", () => {
      const texts: readonly string[] = [
        "{",
        "[]",
        "null",
        JSON.stringify({ label: 1, failures: [] }),
        JSON.stringify({ label: "a", failures: {} }),
        JSON.stringify({ label: "a", failures: [null] }),
        JSON.stringify({ label: "a", failures: [{ name: 1, message: "m", count: 1 }] }),
        JSON.stringify({ label: "a", failures: [{ name: "n", message: 1, count: 1 }] }),
        JSON.stringify({ label: "a", failures: [{ name: "n", message: "m", count: 1.5 }] })
      ];
      for (const text of texts)
        assert.throws(() => NightlyLegResult.parse(text, "a.json"), (error: unknown) => error instanceof NightlyResultException && error.message === "a.json is not a nightly job's result.", text);
      assert.ok(Object.hasOwn(NightlyLegResultTests.refusalOf("{"), "cause"));
      assert.ok(!Object.hasOwn(NightlyLegResultTests.refusalOf("[]"), "cause"));
    });
  }

  private static refusalOf(text: string): Error {
    try {
      NightlyLegResult.parse(text, "a.json");
    }
    catch (error) {
      return error as Error;
    }
    throw new Error("The result was not refused.");
  }
}

NightlyLegResultTests.register();
