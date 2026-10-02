/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestDiscovery, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

import { SampleFixtureTests } from "../fixtures/decorators/sample-fixture.fixture.js";
import { UnmarkedFixtureTests } from "../fixtures/decorators/unmarked-fixture.fixture.js";

@TestClass
export class TestClassDecoratorTests {
  @TestMethod
  public aMarkedClassIsDiscovered(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ SampleFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual(1, discovered.length);
    Assert.areEqual<string | undefined>("SampleFixtureTests", discovered[0]?.className);
  }

  @TestMethod
  public anUnmarkedClassNamedLikeATestClassFails(): void {
    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ UnmarkedFixtureTests }, "inline://sample", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public aMarkedClassWithAForeignNameFails(): void {
    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ Renamed: SampleFixtureTests }, "inline://sample", "TestPackage");
    }, TestingException);
  }

  @TestMethod
  public aMarkedArrowFunctionFails(): void {
    const arrow = (): void => { };
    TestClass(arrow);

    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ ArrowTests: arrow }, "inline://sample", "TestPackage");
    }, TestingException);
  }
}
