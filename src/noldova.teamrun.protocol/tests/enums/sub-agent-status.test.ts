/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SubAgentStatus } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentStatusTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Running", SubAgentStatus.Running);
    Assert.areEqual("Completed", SubAgentStatus.Completed);
    Assert.areEqual("Failed", SubAgentStatus.Failed);
    Assert.areEqual("Stopped", SubAgentStatus.Stopped);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(SubAgentStatus);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
