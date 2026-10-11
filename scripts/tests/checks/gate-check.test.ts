/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GateCheck from "../../checks/gate-check.ts";
import RecordedCheckFixture from "../fixtures/recorded-check.fixture.ts";

class GateCheckTests {
  public static register(): void {
    test("a gate check holds its check, its part and the runner of its tests", () => {
      const check = new RecordedCheckFixture("Checks", []);

      const placed = new GateCheck(check, "angular-and-checks", "angular");
      const other = new GateCheck(check, "packages", null);

      assert.equal(placed.check, check);
      assert.equal(placed.part, "angular-and-checks");
      assert.equal(placed.runner, "angular");
      assert.equal(other.runner, null);
    });
  }
}

GateCheckTests.register();
