/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProtocolVersion } from "@noldova/teamrun-protocol";

@TestClass
export class ProtocolVersionTests {
  @TestMethod
  public currentIsZeroDotOne(): void {
    Assert.areEqual(0, ProtocolVersion.current.major);
    Assert.areEqual(1, ProtocolVersion.current.minor);
    Assert.areEqual("0.1", ProtocolVersion.current.toString());
  }

  @TestMethod
  public parsesMajorDotMinorText(): void {
    const version = ProtocolVersion.parse("12.3");

    Assert.areEqual(12, version.major);
    Assert.areEqual(3, version.minor);
  }

  @TestMethod
  public rejectsMalformedText(): void {
    for (const text of ["1", "1.2.3", "a.b", "-1.0", "1.5.", String.empty, "1.-2"])
      Assert.throws(() => ProtocolVersion.parse(text), ArgumentException);
  }

  @TestMethod
  public rejectsNegativeOrFractionalParts(): void {
    Assert.throws(() => new ProtocolVersion(-1, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new ProtocolVersion(1, -1), ArgumentOutOfRangeException);
    Assert.throws(() => new ProtocolVersion(1.5, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new ProtocolVersion(1, 0.5), ArgumentOutOfRangeException);
  }

  @TestMethod
  public servesOnlyAnExactVersionMatch(): void {
    const runtime = new ProtocolVersion(1, 2);

    Assert.isTrue(runtime.canServe(new ProtocolVersion(1, 2)));
    Assert.isFalse(runtime.canServe(new ProtocolVersion(1, 0)));
    Assert.isFalse(runtime.canServe(new ProtocolVersion(1, 3)));
    Assert.isFalse(runtime.canServe(new ProtocolVersion(2, 0)));
    Assert.isFalse(runtime.canServe(new ProtocolVersion(0, 2)));
  }

  @TestMethod
  public currentRejectsDifferentMajorOrMinorVersions(): void {
    Assert.isTrue(ProtocolVersion.current.canServe(new ProtocolVersion(0, 1)));
    Assert.isFalse(ProtocolVersion.current.canServe(new ProtocolVersion(0, 0)));
    Assert.isFalse(ProtocolVersion.current.canServe(new ProtocolVersion(0, 2)));
    Assert.isFalse(ProtocolVersion.current.canServe(new ProtocolVersion(1, 1)));
  }

  @TestMethod
  public comparesForEquality(): void {
    Assert.isTrue(new ProtocolVersion(1, 2).equals(new ProtocolVersion(1, 2)));
    Assert.isFalse(new ProtocolVersion(1, 2).equals(new ProtocolVersion(1, 3)));
    Assert.isFalse(new ProtocolVersion(1, 2).equals(new ProtocolVersion(2, 2)));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const version = ProtocolVersion.fromJson(new ProtocolVersion(3, 4).toJson());

    Assert.areEqual(3, version.major);
    Assert.areEqual(4, version.minor);
  }

  @TestMethod
  public reportsInvalidJsonWithThePath(): void {
    Assert.areEqual("$.version.minor", Assert.throws(() => ProtocolVersion.fromJson({ major: 1 }, "$.version"), JsonException).path);
    Assert.areEqual("$.major", Assert.throws(() => ProtocolVersion.fromJson({ major: "1", minor: 0 }), JsonException).path);
  }
}
