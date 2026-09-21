/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ArgumentOutOfRangeException,
  IndexOutOfRangeException,
} from "@noldova/teamrun-foundation-exceptions";
import { ReadOnlyStringSpan } from "@noldova/teamrun-foundation-text";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class ReadOnlyStringSpanTests {
  @TestMethod
  public representsTheCompleteSourceByDefault(): void {
    const span = new ReadOnlyStringSpan("hello");

    Assert.areEqual(5, span.length);
    Assert.isFalse(span.isEmpty);
    Assert.areEqual("hello", span.toString());
  }

  @TestMethod
  public representsAnExplicitSourceRange(): void {
    const span = new ReadOnlyStringSpan("hello world", 6, 5);

    Assert.areEqual(5, span.length);
    Assert.areEqual("world", span.toString());
  }

  @TestMethod
  public defaultsTheLengthToTheRemainingSource(): void {
    const span = new ReadOnlyStringSpan("hello", 2);

    Assert.areEqual("llo", span.toString());
  }

  @TestMethod
  public providesTheCanonicalEmptySpan(): void {
    Assert.areEqual(0, ReadOnlyStringSpan.empty.length);
    Assert.isTrue(ReadOnlyStringSpan.empty.isEmpty);
    Assert.areEqual(String.empty, ReadOnlyStringSpan.empty.toString());
  }

  @TestMethod
  public returnsUtf16CodeUnits(): void {
    const span = new ReadOnlyStringSpan("😀");

    Assert.areEqual(2, span.length);
    Assert.areEqual(0xD83D, span.get(0).charCodeAt(0));
    Assert.areEqual(0xDE00, span.get(1).charCodeAt(0));
  }

  @TestMethod
  public slicesWithoutCopyingTheRangeContract(): void {
    const span = new ReadOnlyStringSpan("hello world");
    const slice = span.slice(6, 5);

    Assert.isInstanceOf(slice, ReadOnlyStringSpan);
    Assert.areEqual("world", slice.toString());
    Assert.areEqual(5, slice.length);
  }

  @TestMethod
  public defaultsASliceThroughTheEndOfTheSpan(): void {
    const span = new ReadOnlyStringSpan("hello");

    Assert.areEqual("llo", span.slice(2).toString());
    Assert.isTrue(span.slice(span.length).isEmpty);
  }

  @TestMethod
  public keepsNestedSlicesInsideTheirParentSpan(): void {
    const span = new ReadOnlyStringSpan("0123456789", 2, 4);

    Assert.areEqual("34", span.slice(1, 2).toString());
    Assert.throws(() => span.slice(4, 1), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidStarts(): void {
    Assert.throws(() => new ReadOnlyStringSpan("text", -1), ArgumentOutOfRangeException);
    Assert.throws(() => new ReadOnlyStringSpan("text", 0.5), ArgumentOutOfRangeException);
    Assert.throws(() => new ReadOnlyStringSpan("text", 5), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidLengths(): void {
    Assert.throws(() => new ReadOnlyStringSpan("text", 0, -1), ArgumentOutOfRangeException);
    Assert.throws(() => new ReadOnlyStringSpan("text", 0, 0.5), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsRangesBeyondTheSource(): void {
    Assert.throws(() => new ReadOnlyStringSpan("text", 3, 2), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidIndexes(): void {
    const span = new ReadOnlyStringSpan("text");

    Assert.throws(() => span.get(-1), IndexOutOfRangeException);
    Assert.throws(() => span.get(4), IndexOutOfRangeException);
    Assert.throws(() => span.get(0.5), IndexOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidSliceRanges(): void {
    const span = new ReadOnlyStringSpan("text");

    Assert.throws(() => span.slice(-1), ArgumentOutOfRangeException);
    Assert.throws(() => span.slice(0.5), ArgumentOutOfRangeException);
    Assert.throws(() => span.slice(5), ArgumentOutOfRangeException);
    Assert.throws(() => span.slice(0, -1), ArgumentOutOfRangeException);
    Assert.throws(() => span.slice(0, 0.5), ArgumentOutOfRangeException);
    Assert.throws(() => span.slice(3, 2), ArgumentOutOfRangeException);
  }
}
