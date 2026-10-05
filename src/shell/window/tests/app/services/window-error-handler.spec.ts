/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
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

  it("handles an error object once however many times it is reported, and repeated texts every time", () => {
    const error = new Error("Reported twice.");

    handler.handleError(error);
    handler.handleError(error);
    handler.handleError("Repeated.");
    handler.handleError("Repeated.");

    expect(bridge.errorsLogged).toEqual([[null, error.stack], [null, "Repeated."], [null, "Repeated."]]);
    expect(written).toHaveBeenCalledTimes(3);
  });

  it("drops a failure because the connection to the runtime ended, anywhere in its causes, but sends an action the runtime did not confirm", () => {
    const disconnected = new RuntimeDisconnectedException("TeamRun is not connected to its runtime.");
    const action = new ActionNotConfirmedException("The command notes.save did not finish because the connection to the runtime ended.", disconnected);

    handler.handleError(disconnected);
    handler.handleError(new WindowPartFailureException("notes", "Its views failed to load.", disconnected));
    handler.handleError(action);

    expect(bridge.errorsLogged).toEqual([[null, `${action.stack}\nCaused by: ${disconnected.stack}`]]);
    expect(written).toHaveBeenCalledTimes(1);
  });

  it("sends every error, cutting one longer than the log takes to its first 65536 characters", () => {
    for (let index = 0; index < 12; index++)
      handler.handleError(`Error ${index}`);
    handler.handleError(`${"x".repeat(65536)}left out`);

    expect(bridge.errorsLogged.map(t => t[1])).toEqual([...Array.from({ length: 12 }, (_, index) => `Error ${index}`), "x".repeat(65536)]);
    expect(written).toHaveBeenCalledTimes(13);
  });
});
