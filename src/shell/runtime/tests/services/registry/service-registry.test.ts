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
import { RegistrationException, ServiceRegistry } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ServiceRegistryTests {
  private static readonly NAME: QualifiedName = new QualifiedName("notes", "store");

  @TestMethod
  public findsAPublishedServiceUntilItsRegistrationIsDisposed(): void {
    const registry = new ServiceRegistry();
    const service = new Map<string, string>();

    const registration = registry.publish(ServiceRegistryTests.NAME, service);
    const found = registry.find(new QualifiedName("notes", "store"));
    registration[Symbol.dispose]();

    Assert.areEqual<unknown>(service, found);
    Assert.isUndefined(registry.find(ServiceRegistryTests.NAME));
  }

  @TestMethod
  public refusesASecondServiceUnderOneName(): void {
    const registry = new ServiceRegistry();
    registry.publish(ServiceRegistryTests.NAME, new Map());

    const exception = Assert.throws(() => registry.publish(ServiceRegistryTests.NAME, new Set()), RegistrationException);

    Assert.areEqual("The service notes.store is already published.", exception.message);
  }

  @TestMethod
  public anOldRegistrationLeavesALaterServiceInPlace(): void {
    const registry = new ServiceRegistry();
    const first = registry.publish(ServiceRegistryTests.NAME, new Map());
    first[Symbol.dispose]();
    const later = new Set<string>();
    registry.publish(ServiceRegistryTests.NAME, later);

    first[Symbol.dispose]();

    Assert.areEqual<unknown>(later, registry.find(ServiceRegistryTests.NAME));
  }
}
