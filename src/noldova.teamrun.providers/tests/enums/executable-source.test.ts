/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExecutableSource } from "@noldova/teamrun.providers";

@TestClass
export class ExecutableSourceTests {
  @TestMethod
  public namesEverySource(): void {
    Assert.areEqual("Override,GlobalNpm,LocalBin,Path,Managed", Object.values(ExecutableSource).join(","));
  }
}
