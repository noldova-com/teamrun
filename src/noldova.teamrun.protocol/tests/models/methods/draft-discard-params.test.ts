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
import { DraftDiscardParams } from "@noldova/teamrun.protocol";

@TestClass
export class DraftDiscardParamsTests {
  @TestMethod
  public roundTripsThroughJsonWithAndWithoutARevision(): void {
    for (const json of [{ chatId: "conv-1", revision: 3 }, { chatId: "conv-1", revision: null }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(DraftDiscardParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new DraftDiscardParams(String.empty), ArgumentException);
    for (const revision of [0, -1, 1.5])
      Assert.throws(() => new DraftDiscardParams("conv-1", revision), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => DraftDiscardParams.fromJson({ chatId: "conv-1", revision: "two" }), JsonException);

    Assert.areEqual("$.revision", exception.path);
  }
}
