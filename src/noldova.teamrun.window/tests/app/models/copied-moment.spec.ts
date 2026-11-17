/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CopiedMoment } from "../../../src/app/models/copied-moment";
import { FakeClock } from "../../fixtures/fake-clock.fixture";

describe("CopiedMoment", () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = new FakeClock(0);
  });

  it("shows what was copied for 1.5 seconds, then nothing", () => {
    const moment = new CopiedMoment<string>(clock);

    moment.show("address");
    const shown = [moment.shown(), clock.remaining];
    clock.advance(1499);
    const before = moment.shown();
    clock.advance(1);

    expect([shown, before]).toEqual([["address", [1500]], "address"]);
    expect([moment.shown(), clock.remaining]).toEqual([null, []]);
  });

  it("moves to a second copy made within the moment and starts the moment again from it", () => {
    const moment = new CopiedMoment<string>(clock);

    moment.show("address");
    clock.advance(1000);
    moment.show("token");
    const moved = [moment.shown(), clock.remaining];
    clock.advance(1000);
    const later = moment.shown();
    clock.advance(500);

    expect([moved, later, moment.shown()]).toEqual([["token", [1500]], "token", null]);
  });

  it("clears at once, stopping the moment", () => {
    const moment = new CopiedMoment<string>(clock);

    moment.show("address");
    moment.clear();

    expect([moment.shown(), clock.remaining]).toEqual([null, []]);
  });

  it("shows nothing more once disposed", () => {
    const moment = new CopiedMoment<string>(clock);

    moment.show("address");
    moment.dispose();
    const disposed = [moment.shown(), clock.remaining];
    moment.show("token");

    expect([disposed, moment.shown(), clock.remaining]).toEqual([[null, []], null, []]);
  });

  it("uses the real clock when given none", () => {
    const moment = new CopiedMoment<string>();

    moment.show("address");
    const shown = moment.shown();
    moment.dispose();

    expect([shown, moment.shown()]).toEqual(["address", null]);
  });
});
