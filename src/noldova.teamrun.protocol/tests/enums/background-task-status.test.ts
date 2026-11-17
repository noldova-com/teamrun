/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Running", BackgroundTaskStatus.Running);
    Assert.areEqual("Completed", BackgroundTaskStatus.Completed);
    Assert.areEqual("Failed", BackgroundTaskStatus.Failed);
    Assert.areEqual("Stopped", BackgroundTaskStatus.Stopped);
    Assert.areEqual("Ended", BackgroundTaskStatus.Ended);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(BackgroundTaskStatus);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
