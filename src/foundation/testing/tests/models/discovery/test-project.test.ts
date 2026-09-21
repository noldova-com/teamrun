/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod, TestProject } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestProjectTests {
  @TestMethod
  public carriesTheExplicitIdentityAndRoot(): void {
    const project = new TestProject("TestPackage", "compiled/tests");

    Assert.areEqual("TestPackage", project.packageName);
    Assert.areEqual("compiled/tests", project.rootDirectory);
  }

  @TestMethod
  public rejectsAWhitespacePackageName(): void {
    Assert.throws(() => new TestProject(" ", "compiled/tests"), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceRootDirectory(): void {
    Assert.throws(() => new TestProject("TestPackage", " "), ArgumentException);
  }
}
