/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, Request, WireMessageKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class RequestTests {
  @TestMethod
  public roundTripsARequestWithoutATimeLimit(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("checkpoints.capture"), { folder: "a" }).toJson());

    Assert.areEqual(WireMessageKind.Request, request.kind);
    Assert.areEqual("r1", request.id);
    Assert.areEqual("checkpoints.capture", request.method.text);
    Assert.areEqual("{\"folder\":\"a\"}", JSON.stringify(request.payload));
    Assert.isUndefined(request.timeoutMilliseconds);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"checkpoints.capture\",\"payload\":{\"folder\":\"a\"}}", request.toText());
  }

  @TestMethod
  public roundTripsATimeLimit(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("shell.ping"), null, 250).toJson());

    Assert.areEqual(250, request.timeoutMilliseconds);
    Assert.isNull(request.payload);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"shell.ping\",\"payload\":null,\"timeoutMilliseconds\":250}", request.toText());
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  public rejectsAnInvalidTimeLimit(timeout: number): void {
    Assert.throws(() => new Request("r1", QualifiedName.parse("shell.ping"), null, timeout), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsABlankId(): void {
    Assert.throws(() => new Request(" ", QualifiedName.parse("shell.ping"), null), ArgumentException);
  }

  @TestMethod
  @TestData("{\"id\":\"r1\",\"method\":\"ping\",\"payload\":null}", "$.method")
  @TestData("{\"id\":\"r1\",\"method\":\"shell.ping\",\"payload\":null,\"timeoutMilliseconds\":0}", "$.timeoutMilliseconds")
  @TestData("{\"id\":\"r1\",\"method\":\"shell.ping\",\"payload\":null,\"timeoutMilliseconds\":\"5\"}", "$.timeoutMilliseconds")
  @TestData("{\"id\":\"\",\"method\":\"shell.ping\",\"payload\":null}", "$.id")
  @TestData("{\"id\":\"r1\",\"method\":\"shell.ping\"}", "$.payload")
  public namesTheInvalidFieldOnTheWire(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => Request.fromJson(JSON.parse(text)), JsonException).path);
  }
}
