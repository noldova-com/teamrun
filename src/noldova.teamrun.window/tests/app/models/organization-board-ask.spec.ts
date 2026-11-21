/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Harness, Teammate, TeammateStatus } from "@noldova/teamrun.protocol";

import { OrganizationBoardAsk } from "../../../src/app/models/organization-board-ask";

describe("OrganizationBoardAsk", () => {
  it("answers who waits, opens who stopped, and messages who reached the usage limit", () => {
    const bob = new Teammate("bob", "Bob", null, "a1", Harness.Provider, null, null, "t", "t");

    expect([TeammateStatus.WaitingForYou, TeammateStatus.Stopped, TeammateStatus.UsageLimit].map(t => new OrganizationBoardAsk(bob, "Design", t).action))
      .toEqual(["Answer", "Open", "Message"]);
  });
});
