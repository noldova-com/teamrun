/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { ActionNotSentException } from "../../../src/app/exceptions/action-not-sent.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";

describe("ActionNotSentException", () => {
  it("stands for a failure because the connection to the runtime ended, anywhere in its causes, with the action's message and no cause", () => {
    const disconnected = new RuntimeDisconnectedException("TeamRun is not connected to its runtime.");
    const wrapped = new Error("The note was not saved.", { cause: disconnected });

    const actions = [disconnected, wrapped].map(t => ActionNotSentException.from(t, "The command notes.save did not finish."));

    expect(actions.map(t => [t instanceof ActionNotSentException, t instanceof Exception, (t as Error).message, (t as Error).cause]))
      .toEqual([[true, true, "The command notes.save did not finish.", undefined], [true, true, "The command notes.save did not finish.", undefined]]);
    expect(actions.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([false, false]);
  });

  it("leaves any other failure as it is", () => {
    const values: unknown[] = [new RuntimeRequestException("Unavailable", "The runtime did not answer notes.save in time."), new Error("A defect."), "A thrown text."];

    expect(values.map(t => ActionNotSentException.from(t, "The command notes.save did not finish."))).toEqual(values);
  });
});
