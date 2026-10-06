/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateBarrierStatus, UpdateInProgressException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class UpdateInProgressExceptionTests {
  @TestMethod
  public saysWhetherAnUpdateIsUnderWayOrMayNotHaveFinished(): void {
    const held = new UpdateInProgressException(UpdateBarrierStatus.Held);
    const unfinished = new UpdateInProgressException(UpdateBarrierStatus.Unfinished);

    Assert.areEqual("TeamRun is installing an update.", held.message);
    Assert.areEqual(UpdateBarrierStatus.Held, held.status);
    Assert.areEqual("An update of TeamRun may still be installing, or it did not finish. Open TeamRun to settle it.", unfinished.message);
    Assert.areEqual(UpdateBarrierStatus.Unfinished, unfinished.status);
    Assert.areEqual("UpdateInProgressException", held.name);
  }
}
