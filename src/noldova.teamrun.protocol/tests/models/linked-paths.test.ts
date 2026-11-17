/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LinkedPaths } from "@noldova/teamrun.protocol";

@TestClass
export class LinkedPathsTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { paths: ["/home/a/app/icon-preview", "C:\\repo\\docs"] };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(LinkedPaths.fromJson(json).toJson()));
    Assert.areEqual(JSON.stringify({ paths: [] }), JSON.stringify(new LinkedPaths([]).toJson()));
  }

  @TestMethod
  public rejectsABlankPath(): void {
    Assert.throws(() => new LinkedPaths(["/a", " "]), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => LinkedPaths.fromJson({ paths: ["/a", 7] }), JsonException);

    Assert.areEqual("$.paths.1", exception.path);
  }
}
