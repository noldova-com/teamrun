/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class NameofTests {
  @TestMethod
  public returnsAStringMemberName(): void {
    Assert.areEqual("empty", nameof<StringConstructor>("empty"));
  }

  @TestMethod
  public returnsASelectedMemberName(): void {
    Assert.areEqual("isNullOrEmpty", nameof<StringConstructor>(t => t.isNullOrEmpty));
  }

  @TestMethod
  public returnsAComputedSelectedMemberName(): void {
    Assert.areEqual("empty", nameof<StringConstructor>(t => t["empty"]));
  }

  @TestMethod
  public rejectsASelectorWithoutAMemberAccess(): void {
    Assert.throws(() => nameof<StringConstructor>((): "empty" => "empty"), TypeError);
  }

  @TestMethod
  public rejectsASelectorWithMultipleMemberAccesses(): void {
    Assert.throws(() => nameof<StringConstructor>(t => {
      const memberName = t.empty;
      void t.isNullOrEmpty;

      return memberName;
    }), TypeError);
  }

  @TestMethod
  public rejectsASelectorThatDoesNotReturnTheSelectedMember(): void {
    Assert.throws(() => nameof<StringConstructor>(t => {
      void t.empty;

      return "isNullOrEmpty";
    }), TypeError);
  }

  @TestMethod
  public rejectsASymbolMemberAccess(): void {
    Assert.throws(() => nameof<Map<string, number>>(t => {
      void t[Symbol.iterator];

      return "size";
    }), TypeError);
  }

  @TestMethod
  public preservesASelectorFailureAsTheCause(): void {
    const cause = new Error("selector failure");
    const failure = Assert.throws(() => nameof<StringConstructor>(() => {
      throw cause;
    }), TypeError);

    Assert.areEqual<unknown>(cause, failure.cause);
  }
}
