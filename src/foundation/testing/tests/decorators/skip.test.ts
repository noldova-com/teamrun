/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, Skip, TestClass, TestDiscovery, TestMethod } from "@noldova/teamrun-foundation-testing";

import { PartlySkippedFixtureTests } from "../fixtures/decorators/partly-skipped-fixture.fixture.js";
import { SkippedFixtureTests } from "../fixtures/decorators/skipped-fixture.fixture.js";

@TestClass
export class SkipDecoratorTests {
  @TestMethod
  public anEmptyReasonIsRejected(): void {
    Assert.throws(() => {
      Skip("");
    }, ArgumentException);
  }

  @TestMethod
  public aWhitespaceReasonIsRejected(): void {
    Assert.throws(() => {
      Skip("   ");
    }, ArgumentException);
  }

  @TestMethod
  public aClassSkipIsDiscovered(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ SkippedFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual<string | undefined>("the whole fixture is pending", discovered[0]?.skipReason);
  }

  @TestMethod
  public aMethodSkipIsDiscovered(): void {
    const discovered = new TestDiscovery().discoverModuleExports({ PartlySkippedFixtureTests }, "inline://sample", "TestPackage");

    Assert.areEqual<string | undefined>(undefined, discovered[0]?.skipReason);
    Assert.areEqual<string | undefined>(undefined, discovered[0]?.methods.find(t => t.methodName === "active")?.skipReason);
    Assert.areEqual<string | undefined>("this method is pending", discovered[0]?.methods.find(t => t.methodName === "pending")?.skipReason);
  }
}
