/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";
import { type IMethodHandler, MethodRegistry, RegistrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class MethodRegistryTests {
  private static readonly NAME: QualifiedName = new QualifiedName("notes", "open");
  private static readonly FIRST: IMethodHandler = { handleAsync: () => Promise.resolve(1) };
  private static readonly SECOND: IMethodHandler = { handleAsync: () => Promise.resolve(2) };

  @TestMethod
  public findsARegisteredHandlerByName(): void {
    const registry = new MethodRegistry();

    registry.register(MethodRegistryTests.NAME, MethodRegistryTests.FIRST);

    Assert.areEqual(MethodRegistryTests.FIRST, registry.find(QualifiedName.parse("notes.open")));
    Assert.isUndefined(registry.find(new QualifiedName("notes", "close")));
  }

  @TestMethod
  public refusesASecondHandlerForOneName(): void {
    const registry = new MethodRegistry();
    registry.register(MethodRegistryTests.NAME, MethodRegistryTests.FIRST);

    const exception = Assert.throws(() => registry.register(MethodRegistryTests.NAME, MethodRegistryTests.SECOND), RegistrationException);

    Assert.areEqual("The method notes.open is already registered.", exception.message);
    Assert.areEqual(MethodRegistryTests.FIRST, registry.find(MethodRegistryTests.NAME));
  }

  @TestMethod
  public disposingARegistrationRemovesOnlyItsOwnHandler(): void {
    const registry = new MethodRegistry();
    const first = registry.register(MethodRegistryTests.NAME, MethodRegistryTests.FIRST);

    first[Symbol.dispose]();
    Assert.isUndefined(registry.find(MethodRegistryTests.NAME));
    registry.register(MethodRegistryTests.NAME, MethodRegistryTests.SECOND);
    first[Symbol.dispose]();

    Assert.areEqual(MethodRegistryTests.SECOND, registry.find(MethodRegistryTests.NAME));
  }
}
