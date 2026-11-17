/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentContent } from "@noldova/teamrun.protocol";

@TestClass
export class AttachmentContentTests {
  @TestMethod
  public roundTripsThroughJsonWithAndWithoutBytes(): void {
    for (const json of [{ name: "notes.txt", mediaType: "text/plain", size: 5, data: "aGVsbG8=" }, { name: "empty.txt", mediaType: "text/plain", size: 0, data: "" }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(AttachmentContent.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new AttachmentContent(String.empty, "text/plain", 0, ""), ArgumentException);
    Assert.throws(() => new AttachmentContent("a", " ", 0, ""), ArgumentException);
    for (const size of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      Assert.throws(() => new AttachmentContent("a", "text/plain", size, ""), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => AttachmentContent.fromJson({ name: "a", mediaType: "text/plain", size: 1, data: null }), JsonException);

    Assert.areEqual("$.data", exception.path);
  }
}
