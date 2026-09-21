/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import type { NameofSelector } from "@noldova/teamrun-foundation-core";
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
  public rejectsANonStringAndNonSelectorValue(): void {
    Assert.throws(() => Reflect.apply(nameof, undefined, [42]), TypeError);
  }

  @TestMethod
  public rejectsASelectorWithoutAMemberAccess(): void {
    Assert.throws(() => Reflect.apply(nameof, undefined, [() => "empty"]), TypeError);
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
    const selector = (t: NameofSelector<StringConstructor>): string => {
      void t.empty;

      return "different";
    };

    Assert.throws(() => Reflect.apply(nameof, undefined, [selector]), TypeError);
  }

  @TestMethod
  public rejectsANestedMemberAccess(): void {
    const selector = (t: NameofSelector<StringConstructor>): number => t.empty.length;

    Assert.throws(() => Reflect.apply(nameof, undefined, [selector]), TypeError);
  }

  @TestMethod
  public rejectsASymbolMemberAccess(): void {
    const selector = (t: object): unknown => Reflect.get(t, Symbol("member"));

    Assert.throws(() => Reflect.apply(nameof, undefined, [selector]), TypeError);
  }

  @TestMethod
  public preservesASelectorFailureAsTheCause(): void {
    const cause = new Error("selector failure");
    const failure = Assert.throws(() => Reflect.apply(nameof, undefined, [() => {
      throw cause;
    }]), TypeError);

    Assert.areEqual<unknown>(cause, failure.cause);
  }
}
