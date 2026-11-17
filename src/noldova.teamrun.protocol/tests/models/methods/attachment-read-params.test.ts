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
import { AttachmentReadParams } from "@noldova/teamrun.protocol";

@TestClass
export class AttachmentReadParamsTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { chatId: "conv-1", path: "/data/attachments/file.png" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(AttachmentReadParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new AttachmentReadParams(String.empty, "/a"), ArgumentException);
    Assert.throws(() => new AttachmentReadParams("conv-1", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => AttachmentReadParams.fromJson({ chatId: "conv-1", path: 7 }), JsonException);

    Assert.areEqual("$.path", exception.path);
  }
}
