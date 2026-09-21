/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ResourcesTests {
  @TestMethod
  public reportsTheCanonicalMessagesWithPaths(): void {
    const reader = JsonReader.fromValue({ nothing: null, ratio: 1.5, blank: " ", kind: "other", list: [1] });

    Assert.areEqual("$: The text is not valid JSON.", Assert.throws(() => JsonReader.parse("{"), JsonException).message);
    Assert.areEqual("$: Expected a JSON object.", Assert.throws(() => JsonReader.fromValue([]), JsonException).message);
    Assert.areEqual("$.missing: The field is required.", Assert.throws(() => reader.readValue("missing"), JsonException).message);
    Assert.areEqual("$.nothing: Null is not an accepted value here.", Assert.throws(() => reader.readString("nothing"), JsonException).message);
    Assert.areEqual("$.ratio: Expected an integer.", Assert.throws(() => reader.readInteger("ratio"), JsonException).message);
    Assert.areEqual("$.blank: Expected a string that is not blank.", Assert.throws(() => reader.readNonBlankString("blank"), JsonException).message);
    Assert.areEqual("$.kind: Expected one of a, b.", Assert.throws(() => reader.readOneOf("kind", ["a", "b"]), JsonException).message);
    Assert.areEqual("$.list.0: Expected string.", Assert.throws(() => reader.readStringArray("list"), JsonException).message);
    Assert.areEqual("$.f: A value of type \"function\" cannot be carried as JSON.", Assert.throws(() => JsonReader.toJsonValue({ f: (): void => undefined }), JsonException).message);
  }
}
