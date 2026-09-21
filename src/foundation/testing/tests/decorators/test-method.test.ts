/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestDiscovery, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MethodlessFixtureTests } from "../fixtures/decorators/methodless-fixture.fixture.js";
import { MixedFixtureTests } from "../fixtures/decorators/mixed-fixture.fixture.js";

@TestClass
export class TestMethodDecoratorTests {
  @TestMethod
  public markedMethodsAreDiscoveredInSortedOrder(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ MixedFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual(2, discovered[0]?.methods.length);
    Assert.areEqual<string | undefined>("first", discovered[0]?.methods[0]?.methodName);
    Assert.areEqual<string | undefined>("second", discovered[0]?.methods[1]?.methodName);
  }

  @TestMethod
  public unmarkedMethodsAreNotTests(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ MixedFixtureTests }, "inline://sample", "TestPackage");

    Assert.isTrue(discovered[0]?.methods.every(t => t.methodName !== "unmarkedSupport") ?? false);
  }

  @TestMethod
  public aTestClassWithoutTestMethodsFails(): void {
    Assert.throws(() => {
      new TestDiscovery().discoverModuleExports({ MethodlessFixtureTests }, "inline://sample", "TestPackage");
    }, TestingException);
  }
}
