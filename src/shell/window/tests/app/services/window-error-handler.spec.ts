/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { WindowErrorHandler } from "../../../src/app/services/window-error-handler";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("WindowErrorHandler", () => {
  let bridge: DesktopBridgeFixture;
  let handler: WindowErrorHandler;
  let written: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [WindowErrorHandler] });
    handler = TestBed.inject(WindowErrorHandler);
    written = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
    vi.useRealTimers();
  });

  it("writes each error to the console and sends it with its stack and causes to the desktop, under the module's id for a window part's failure", () => {
    const plain = new Error("A defect.");
    const bare = new TypeError("No stack.");
    delete bare.stack;
    const failure = new WindowPartFailureException("clock", "Its window part failed to activate.", bare);

    handler.handleError(plain);
    handler.handleError("A thrown text.");
    handler.handleError(failure);

    expect(written).toHaveBeenCalledTimes(3);
    expect(bridge.errorsLogged).toEqual([
      [null, plain.stack],
      [null, "A thrown text."],
      ["clock", `${failure.stack}\nCaused by: TypeError: No stack.`]
    ]);
  });

  it("sends ten errors a minute, then says more were left out, and sends again once the minute has passed", () => {
    vi.useFakeTimers();
    for (let index = 0; index < 12; index++)
      handler.handleError(`Error ${index}`);
    vi.advanceTimersByTime(60000);
    handler.handleError("Error 12");

    expect(bridge.errorsLogged.map(t => t[1])).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `Error ${index}`),
      "More errors followed within a minute; they are left out of the log until the minute has passed.",
      "Error 12"
    ]);
    expect(written).toHaveBeenCalledTimes(13);
  });
});
