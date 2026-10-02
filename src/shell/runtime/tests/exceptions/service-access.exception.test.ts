/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ServiceAccessException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ServiceAccessExceptionTests {
  @TestMethod
  public keepsTheMessage(): void {
    const exception = new ServiceAccessException("No service tasks.store is published.");

    Assert.areEqual("No service tasks.store is published.", exception.message);
    Assert.areEqual("ServiceAccessException", exception.name);
  }
}
