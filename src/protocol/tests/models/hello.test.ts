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
import { Hello, ProtocolVersion, WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class HelloTests {
  @TestMethod
  public carriesVersionTokenAndClient(): void {
    const hello = new Hello(new ProtocolVersion(1, 0), "secret", "desktop");

    Assert.areEqual(WireMessageKind.Hello, hello.kind);
    Assert.areEqual("secret", hello.token);
    Assert.areEqual("desktop", hello.client);
    Assert.areEqual("1.0", hello.version.toString());
  }

  @TestMethod
  public rejectsBlankTokenOrClient(): void {
    Assert.throws(() => new Hello(ProtocolVersion.current, " ", "cli"), ArgumentException);
    Assert.throws(() => new Hello(ProtocolVersion.current, "token", String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const hello = Hello.fromJson(new Hello(new ProtocolVersion(2, 1), "secret", "cli").toJson());

    Assert.areEqual("secret", hello.token);
    Assert.areEqual("cli", hello.client);
    Assert.isTrue(hello.version.equals(new ProtocolVersion(2, 1)));
    Assert.areEqual("{\"kind\":\"Hello\",\"version\":{\"major\":2,\"minor\":1},\"token\":\"secret\",\"client\":\"cli\"}", hello.toText());
  }

  @TestMethod
  public reportsMissingOrInvalidFieldsWithThePath(): void {
    Assert.areEqual("$.version", Assert.throws(() => Hello.fromJson({ token: "t", client: "c" }), JsonException).path);
    Assert.areEqual("$.version.major", Assert.throws(() => Hello.fromJson({ version: { minor: 0 }, token: "t", client: "c" }), JsonException).path);
    const blankToken = Assert.throws(() => Hello.fromJson({ version: { major: 1, minor: 0 }, token: String.empty, client: "c" }), JsonException);
    Assert.areEqual("$.token", blankToken.path);
  }
}
