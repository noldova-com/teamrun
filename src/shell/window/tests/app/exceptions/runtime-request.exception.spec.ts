/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";

describe("RuntimeRequestException", () => {
  it("is an exception with the failure's code, message and details", () => {
    const exception = new RuntimeRequestException("NotFound", "There is no such note.", { path: "/notes/a.md" });

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.code, exception.message, exception.details]).toEqual(["NotFound", "There is no such note.", { path: "/notes/a.md" }]);
  });

  it("has no details when the failure has none", () => {
    const exception = new RuntimeRequestException("Unavailable", "TeamRun is not connected to its runtime.");

    expect(exception.details).toBeUndefined();
  });

  it("recognizes a request that failed because the connection to the runtime ended, anywhere in an error's causes", () => {
    const disconnected = new RuntimeRequestException("Disconnected", "TeamRun is not connected to its runtime.");
    const wrapped = new Error("The part failed to continue.", { cause: new Error("Its options were not read.", { cause: disconnected }) });

    expect([disconnected, wrapped].map(t => RuntimeRequestException.isDisconnected(t))).toEqual([true, true]);
  });

  it("does not take another failure, a failure of another code or a value that is not an error for one", () => {
    const unavailable = new RuntimeRequestException("Unavailable", "This device has no identity.");
    const values: unknown[] = [unavailable, new Error("A defect.", { cause: unavailable }), new Error("A defect."), "Disconnected", null];

    expect(values.map(t => RuntimeRequestException.isDisconnected(t))).toEqual([false, false, false, false, false]);
  });
});
