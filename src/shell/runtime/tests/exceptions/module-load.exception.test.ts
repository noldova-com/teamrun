/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleLoadException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ModuleLoadExceptionTests {
  @TestMethod
  public keepsTheMessage(): void {
    const exception = new ModuleLoadException("The package does not export a RuntimePart class.");

    Assert.areEqual("The package does not export a RuntimePart class.", exception.message);
    Assert.areEqual("ModuleLoadException", exception.name);
  }
}
