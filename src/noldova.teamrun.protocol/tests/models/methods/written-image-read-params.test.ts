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
import { WrittenImageReadParams } from "@noldova/teamrun.protocol";

@TestClass
export class WrittenImageReadParamsTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { chatId: "conv-1", messageId: "msg-1", path: "D:\\work\\app\\chart.png" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(WrittenImageReadParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new WrittenImageReadParams(String.empty, "msg-1", "/a.png"), ArgumentException);
    Assert.throws(() => new WrittenImageReadParams("conv-1", " ", "/a.png"), ArgumentException);
    Assert.throws(() => new WrittenImageReadParams("conv-1", "msg-1", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => WrittenImageReadParams.fromJson({ chatId: "conv-1", messageId: 7, path: "/a.png" }), JsonException);

    Assert.areEqual("$.messageId", exception.path);
  }
}
