/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Request, WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class RequestTests {
  @TestMethod
  public carriesIdMethodAndPayload(): void {
    const request = new Request("r1", "ProjectOpen", { rootPath: "D:/work" });

    Assert.areEqual(WireMessageKind.Request, request.kind);
    Assert.areEqual("r1", request.id);
    Assert.areEqual("ProjectOpen", request.method);
    Assert.areEqual("{\"rootPath\":\"D:/work\"}", JSON.stringify(request.payload));
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"ProjectOpen\",\"payload\":{\"rootPath\":\"D:/work\"}}", request.toText());
  }

  @TestMethod
  public rejectsBlankIdOrMethod(): void {
    Assert.throws(() => new Request(String.empty, "ProjectList", null), ArgumentException);
    Assert.throws(() => new Request("r1", " ", null), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJsonIncludingANullPayload(): void {
    const request = Request.fromJson(new Request("r2", "ProjectList", null).toJson());

    Assert.areEqual("r2", request.id);
    Assert.areEqual("ProjectList", request.method);
    Assert.isNull(request.payload);
  }

  @TestMethod
  public requiresThePayloadToBePresent(): void {
    Assert.areEqual("$.payload", Assert.throws(() => Request.fromJson({ id: "r1", method: "m" }), JsonException).path);
    Assert.areEqual("$.id", Assert.throws(() => Request.fromJson({ method: "m", payload: null }), JsonException).path);
  }
}
