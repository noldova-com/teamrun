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
import { BuildIdentity, FailureCode } from "@noldova/teamrun-shell-protocol";

@TestClass
export class BuildIdentityTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const identity = BuildIdentity.fromJson(new BuildIdentity("0.0.1", 1, "abc").toJson());

    Assert.areEqual("0.0.1", identity.productVersion);
    Assert.areEqual(1, identity.protocolVersion);
    Assert.areEqual("abc", identity.fingerprint);
    Assert.areEqual("{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\"}", JSON.stringify(identity.toJson()));
  }

  @TestMethod
  public servesItsOwnBuild(): void {
    Assert.isNull(new BuildIdentity("0.0.1", 1, "abc").findMismatch(new BuildIdentity("0.0.1", 1, "abc")));
  }

  @TestMethod
  @TestData(2, "abc")
  @TestData(3, "def")
  public refusesAnUnsupportedProtocolVersionBeforeTheBuild(clientVersion: number, clientFingerprint: string): void {
    const runtime = new BuildIdentity("0.0.1", 1, "abc");

    Assert.areEqual(FailureCode.UnsupportedVersion, runtime.findMismatch(new BuildIdentity("0.0.1", clientVersion, clientFingerprint)));
  }

  @TestMethod
  public refusesAnotherBuildsFingerprint(): void {
    Assert.areEqual(FailureCode.BuildMismatch, new BuildIdentity("0.0.1", 1, "abc").findMismatch(new BuildIdentity("0.0.1", 1, "def")));
  }

  @TestMethod
  public refusesAnotherProductVersion(): void {
    Assert.areEqual(FailureCode.BuildMismatch, new BuildIdentity("0.0.1", 1, "abc").findMismatch(new BuildIdentity("0.0.2", 1, "abc")));
  }

  @TestMethod
  public rejectsInvalidParts(): void {
    Assert.throws(() => new BuildIdentity(" ", 1, "abc"), ArgumentException);
    Assert.throws(() => new BuildIdentity("0.0.1", 0, "abc"), ArgumentOutOfRangeException);
    Assert.throws(() => new BuildIdentity("0.0.1", 1.5, "abc"), ArgumentOutOfRangeException);
    Assert.throws(() => new BuildIdentity("0.0.1", 1, ""), ArgumentException);
  }

  @TestMethod
  public namesTheInvalidFieldOnTheWire(): void {
    const failure = Assert.throws(() => BuildIdentity.fromJson({ productVersion: "0.0.1", protocolVersion: -1, fingerprint: "abc" }, "$.identity"), JsonException);

    Assert.areEqual("$.identity.protocolVersion", failure.path);
  }

  @TestMethod
  @TestData("1", 1)
  @TestData("42", 42)
  public parsesAStampedProtocolVersion(text: string, expected: number): void {
    Assert.areEqual(expected, BuildIdentity.parseProtocolVersion(text));
  }

  @TestMethod
  @TestData("__PROTOCOL_VERSION__")
  @TestData("0")
  @TestData("01")
  @TestData("-1")
  @TestData("1.0")
  @TestData("")
  public rejectsAnUnstampedOrInvalidProtocolVersion(text: string): void {
    Assert.throws(() => BuildIdentity.parseProtocolVersion(text), ArgumentException);
  }
}
