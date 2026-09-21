/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StringBuilder } from "@noldova/teamrun-foundation-text";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class StringBuilderTests {
  @TestMethod
  public startsEmpty(): void {
    const builder = new StringBuilder();

    Assert.areEqual(0, builder.length);
    Assert.areEqual(String.empty, builder.toString());
  }

  @TestMethod
  public appendsAndChainsStrings(): void {
    const builder = new StringBuilder();

    const result = builder.append("hello").append(" ").append("world");

    Assert.areEqual(builder, result);
    Assert.areEqual(11, builder.length);
    Assert.areEqual("hello world", builder.toString());
  }

  @TestMethod
  public preservesUtf16ContentAndLength(): void {
    const builder = new StringBuilder();

    builder.append("世界").append("😀");

    Assert.areEqual(4, builder.length);
    Assert.areEqual("世界😀", builder.toString());
  }

  @TestMethod
  public ignoresEmptyAppends(): void {
    const builder = new StringBuilder();

    builder.append(String.empty);

    Assert.areEqual(0, builder.length);
    Assert.areEqual(String.empty, builder.toString());
  }

  @TestMethod
  public clearsAndCanBeReused(): void {
    const builder = new StringBuilder();
    builder.append("before");

    builder.clear();
    builder.append("after");

    Assert.areEqual(5, builder.length);
    Assert.areEqual("after", builder.toString());
  }
}
