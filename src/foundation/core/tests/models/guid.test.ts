/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Guid } from "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class GuidTests {
  private static readonly hyphenatedPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  @TestMethod
  public emptyIsAllZeros(): void {
    Assert.areEqual("00000000-0000-0000-0000-000000000000", Guid.empty.toString());
    Assert.areEqual(0, Guid.empty.version);
  }

  @TestMethod
  public newGuidCreatesDistinctVersion4Values(): void {
    const first = Guid.newGuid();
    const second = Guid.newGuid();

    Assert.isTrue(GuidTests.hyphenatedPattern.test(first.toString()));
    Assert.areEqual(4, first.version);
    Assert.isFalse(first.equals(second));
  }

  @TestMethod
  public createVersion7EncodesTheTimestampInTheLeadingBytes(): void {
    const guid = Guid.createVersion7(0x0123456789ab);

    Assert.isTrue(guid.toString().startsWith("01234567-89ab-7"));
    Assert.areEqual(7, guid.version);
    Assert.isTrue("89ab".includes(guid.toString().charAt(19)));
  }

  @TestMethod
  public createVersion7DefaultsToTheCurrentTime(): void {
    const before = Date.now();
    const guid = Guid.createVersion7();
    const after = Date.now();
    const timestamp = Number.parseInt(guid.toString().slice(0, 13).replace("-", ""), 16);

    Assert.areEqual(7, guid.version);
    Assert.isTrue(timestamp >= before && timestamp <= after);
  }

  @TestMethod
  public createVersion7ValuesSortByTime(): void {
    const earlier = Guid.createVersion7(1_000);
    const later = Guid.createVersion7(1_001);

    Assert.isTrue(earlier.compareTo(later) < 0);
    Assert.isTrue(later.compareTo(earlier) > 0);
  }

  @TestMethod
  public createVersion7RejectsInvalidTimestamps(): void {
    Assert.throws(() => Guid.createVersion7(-1), RangeError);
    Assert.throws(() => Guid.createVersion7(1.5), RangeError);
    Assert.throws(() => Guid.createVersion7(2 ** 48), RangeError);
    Assert.areEqual("ffffffff-ffff-7", Guid.createVersion7(2 ** 48 - 1).toString().slice(0, 15));
  }

  @TestMethod
  public parsesHyphenatedTextInEitherCase(): void {
    const guid = Guid.parse("0123ABCD-EF01-4234-8567-89ABCDEF0123");

    Assert.areEqual("0123abcd-ef01-4234-8567-89abcdef0123", guid.toString());
    Assert.areEqual(4, guid.version);
    Assert.isTrue(guid.equals(Guid.parse("0123abcd-ef01-4234-8567-89abcdef0123")));
  }

  @TestMethod
  public rejectsTextThatIsNotHyphenatedHexadecimal(): void {
    const failure = Assert.throws(() => Guid.parse("not-a-guid"), SyntaxError);

    Assert.areEqual("The text is not a Guid in the hyphenated form of thirty-two hexadecimal digits.", failure.message);
    Assert.throws(() => Guid.parse(""), SyntaxError);
    Assert.throws(() => Guid.parse("{0123abcd-ef01-4234-8567-89abcdef0123}"), SyntaxError);
    Assert.throws(() => Guid.parse("0123abcdef01423485678 9abcdef0123"), SyntaxError);
    Assert.isUndefined(Guid.tryParse("0123abcd-ef01-4234-8567-89abcdef012"));
    Assert.isDefined(Guid.tryParse("0123abcd-ef01-4234-8567-89abcdef0123"));
  }

  @TestMethod
  public comparesByCanonicalTextWhichIsByteOrder(): void {
    const lower = Guid.parse("00000000-0000-0000-0000-000000000001");
    const higher = Guid.parse("00000000-0000-0000-0000-000000000002");

    Assert.areEqual(-1, lower.compareTo(higher));
    Assert.areEqual(1, higher.compareTo(lower));
    Assert.areEqual(0, lower.compareTo(Guid.parse("00000000-0000-0000-0000-000000000001")));
    Assert.isTrue(Guid.empty.compareTo(lower) < 0);
  }
}
