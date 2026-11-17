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
import { Draft, MessageAttachment } from "@noldova/teamrun.protocol";

@TestClass
export class DraftTests {
  private static readonly json: object = {
    chatId: "conv-1",
    text: "Look at this",
    attachments: [{ name: "notes.txt", mediaType: "text/plain", size: 4, path: "/notes.txt", width: null, height: null }],
    missing: ["gone.png"],
    revision: 2,
    updatedAt: "2026-10-17T20:00:00.000Z"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = Draft.fromJson(DraftTests.json);

    Assert.areEqual(JSON.stringify(DraftTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const files = [new MessageAttachment("notes.txt", "text/plain", 4, "/notes.txt")];

    Assert.throws(() => new Draft(String.empty, "", files, [], 1, "now"), ArgumentException);
    Assert.throws(() => new Draft("conv-1", "", files, [], 1, String.empty), ArgumentException);
    Assert.throws(() => new Draft("conv-1", "", files, [" "], 1, "now"), ArgumentException);
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      Assert.throws(() => new Draft("conv-1", "", files, [], revision, "now"), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => Draft.fromJson({ ...DraftTests.json, revision: "two" }), JsonException);

    Assert.areEqual("$.revision", exception.path);
  }
}
