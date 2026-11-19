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
import { AttachmentInput, DraftSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class DraftSaveParamsTests {
  private static readonly json: object = {
    chatId: "conv-1",
    text: "",
    attachments: [
      { name: "new.txt", mediaType: "text/plain", data: "aGk=", path: null },
      { name: "kept.txt", mediaType: "text/plain", data: null, path: "/kept.txt" }
    ],
    revision: 2
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = DraftSaveParams.fromJson(DraftSaveParamsTests.json);

    Assert.areEqual(JSON.stringify(DraftSaveParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public readsAPayloadWithNoRevisionAsReplacingWhateverTheDraftHolds(): void {
    Assert.isNull(DraftSaveParams.fromJson({ chatId: "conv-1", text: "", attachments: [] }).revision);
    Assert.isNull(new DraftSaveParams("conv-1", "").revision);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const file = new AttachmentInput("a.txt", "text/plain", "", null);

    Assert.throws(() => new DraftSaveParams(String.empty, ""), ArgumentException);
    Assert.throws(() => new DraftSaveParams("conv-1", "", Array.from({ length: 11 }, () => file)), ArgumentException);
    Assert.areEqual(10, new DraftSaveParams("conv-1", "", Array.from({ length: 10 }, () => file)).attachments.length);
    for (const revision of [-1, 1.5])
      Assert.throws(() => new DraftSaveParams("conv-1", "", [], revision), ArgumentException);
    Assert.areEqual(0, new DraftSaveParams("conv-1", "", [], 0).revision);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => DraftSaveParams.fromJson({ ...DraftSaveParamsTests.json, chatId: String.empty }), JsonException);

    Assert.areEqual("$.chatId", exception.path);
  }
}
