/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoreApiTests {
  @TestMethod
  public exportsTheCompleteRuntimeSurface(): void {
    const exportNames = Object.keys(api);

    Assert.areEqual(2, exportNames.length);
    Assert.areEqual("Guid", exportNames[0]);
    Assert.areEqual("nameof", exportNames[1]);
    Assert.areEqual(0, api.Guid.empty.version);
    Assert.areEqual("empty", api.nameof<StringConstructor>(t => t.empty));
  }

  @TestMethod
  public installsTheCompleteObjectExtensionSurface(): void {
    const extensionNames = [
      api.nameof<ObjectConstructor>(t => t.isBigInt),
      api.nameof<ObjectConstructor>(t => t.isBoolean),
      api.nameof<ObjectConstructor>(t => t.isFunction),
      api.nameof<ObjectConstructor>(t => t.isNull),
      api.nameof<ObjectConstructor>(t => t.isNullOrUndefined),
      api.nameof<ObjectConstructor>(t => t.isNumber),
      api.nameof<ObjectConstructor>(t => t.isObject),
      api.nameof<ObjectConstructor>(t => t.isString),
      api.nameof<ObjectConstructor>(t => t.isSymbol),
      api.nameof<ObjectConstructor>(t => t.isUndefined)
    ];

    for (const extensionName of extensionNames) {
      const descriptor = Object.getOwnPropertyDescriptor(Object, extensionName);
      Assert.isDefined(descriptor);
      Assert.areEqual("function", typeof descriptor.value);
    }
  }

  @TestMethod
  public installsTheCompleteStringExtensionSurface(): void {
    const emptyDescriptor = Object.getOwnPropertyDescriptor(String, api.nameof<StringConstructor>(t => t.empty));
    Assert.isDefined(emptyDescriptor);
    Assert.areEqual(String.empty, emptyDescriptor.value);

    const extensionNames = [
      api.nameof<StringConstructor>(t => t.format),
      api.nameof<StringConstructor>(t => t.isAsciiDigit),
      api.nameof<StringConstructor>(t => t.isAsciiHexDigit),
      api.nameof<StringConstructor>(t => t.isAsciiLetter),
      api.nameof<StringConstructor>(t => t.isNullOrEmpty),
      api.nameof<StringConstructor>(t => t.isNullOrWhitespace)
    ];

    for (const extensionName of extensionNames) {
      const descriptor = Object.getOwnPropertyDescriptor(String, extensionName);
      Assert.isDefined(descriptor);
      Assert.areEqual("function", typeof descriptor.value);
    }
  }
}
