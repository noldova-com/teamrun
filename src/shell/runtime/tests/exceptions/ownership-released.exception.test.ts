/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OwnershipReleasedException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class OwnershipReleasedExceptionTests {
  @TestMethod
  public saysTheOwnershipWasReleased(): void {
    const exception = new OwnershipReleasedException();

    Assert.areEqual("The data directory's ownership has been released.", exception.message);
    Assert.areEqual("OwnershipReleasedException", exception.name);
  }
}
