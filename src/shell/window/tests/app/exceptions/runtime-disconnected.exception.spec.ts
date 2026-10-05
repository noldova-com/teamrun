/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";

describe("RuntimeDisconnectedException", () => {
  it("is a runtime request failure with the Disconnected code and no details", () => {
    const exception = new RuntimeDisconnectedException("TeamRun is not connected to its runtime.");

    expect(exception).toBeInstanceOf(RuntimeRequestException);
    expect([exception.code, exception.message, exception.details]).toEqual(["Disconnected", "TeamRun is not connected to its runtime.", undefined]);
  });

  it("is found anywhere in an error's causes", () => {
    const disconnected = new RuntimeDisconnectedException("TeamRun is not connected to its runtime.");
    const wrapped = new Error("The part failed to continue.", { cause: new Error("Its options were not read.", { cause: disconnected }) });

    expect([disconnected, wrapped].map(t => RuntimeDisconnectedException.isIn(t))).toEqual([true, true]);
  });

  it("is not found in another failure, a failure of another code or a value that is not an error", () => {
    const unavailable = new RuntimeRequestException("Unavailable", "This device has no identity.");
    const values: unknown[] = [unavailable, new Error("A defect.", { cause: unavailable }), new Error("A defect."), "Disconnected", null];

    expect(values.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([false, false, false, false, false]);
  });
});
