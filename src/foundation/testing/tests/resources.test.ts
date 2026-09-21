/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, AssertFailedException, TestClass, TestMethod, TestTimeoutException } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ResourcesTests {
  @TestMethod
  public defaultsAssertionFailuresToTheCanonicalMessage(): void {
    Assert.areEqual("Assertion failed.", new AssertFailedException().message);
  }

  @TestMethod
  public reportsTheCanonicalConditionMessages(): void {
    Assert.areEqual("Expected the condition to be true.", Assert.throws(() => Assert.isTrue(false), AssertFailedException).message);
    Assert.areEqual("Expected the condition to be false.", Assert.throws(() => Assert.isFalse(true), AssertFailedException).message);
  }

  @TestMethod
  public reportsTheCanonicalEqualityMessage(): void {
    Assert.areEqual("Expected the values to be equal.", Assert.throws(() => Assert.areEqual(1, 2), AssertFailedException).message);
  }

  @TestMethod
  public reportsTheCanonicalTimeoutMessage(): void {
    Assert.areEqual("The test did not settle within the allotted timeout.", new TestTimeoutException(5).message);
  }
}
