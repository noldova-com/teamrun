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
import { OutsideConnection } from "@noldova/teamrun.protocol";

@TestClass
export class OutsideConnectionTests {
  @TestMethod
  public roundTripsThroughJsonWithAndWithoutItsTokenFailureAndNote(): void {
    const values = [new OutsideConnection(true, "http://127.0.0.1:47391/mcp", "abc", null, "Made a new token."),
      new OutsideConnection(false, "http://127.0.0.1:47391/mcp", null, "Port 47391 is in use.", null)];

    const read = values.map(t => OutsideConnection.fromJson(t.toJson())).map(t => [t.enabled, t.url, t.token, t.failure, t.note]);

    Assert.areEqual(JSON.stringify([[true, "http://127.0.0.1:47391/mcp", "abc", null, "Made a new token."],
      [false, "http://127.0.0.1:47391/mcp", null, "Port 47391 is in use.", null]]), JSON.stringify(read));
  }

  @TestMethod
  public rejectsABlankUrlTokenFailureOrNoteWithTheirPath(): void {
    const json = new OutsideConnection(true, "http://127.0.0.1:47391/mcp", "abc", null, null).toJson();

    Assert.throws(() => new OutsideConnection(true, " ", null, null, null), ArgumentException);
    Assert.throws(() => new OutsideConnection(true, "u", " ", null, null), ArgumentException);
    Assert.throws(() => new OutsideConnection(true, "u", null, " ", null), ArgumentException);
    Assert.throws(() => new OutsideConnection(true, "u", null, null, " "), ArgumentException);
    Assert.areEqual(JSON.stringify(["$.url", "$.token", "$.failure", "$.note", "$.enabled"]), JSON.stringify([
      Assert.throws(() => OutsideConnection.fromJson({ ...json, url: " " }), JsonException).path,
      Assert.throws(() => OutsideConnection.fromJson({ ...json, token: " " }), JsonException).path,
      Assert.throws(() => OutsideConnection.fromJson({ ...json, failure: " " }), JsonException).path,
      Assert.throws(() => OutsideConnection.fromJson({ ...json, note: " " }), JsonException).path,
      Assert.throws(() => OutsideConnection.fromJson({ ...json, enabled: "yes" }), JsonException).path]));
  }
}
