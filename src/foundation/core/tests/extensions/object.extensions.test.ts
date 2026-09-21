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
export class ObjectExtensionsTests {
  @TestMethod
  public primitiveGuardsRejectBoxedValues(): void {
    Assert.isTrue(Object.isBigInt(1n));
    Assert.isFalse(Object.isBigInt(Object(1n)));
    Assert.isTrue(Object.isBoolean(false));
    Assert.isFalse(Object.isBoolean(new Boolean(false)));
    Assert.isTrue(Object.isNumber(Number.NaN));
    Assert.isTrue(Object.isNumber(Number.POSITIVE_INFINITY));
    Assert.isFalse(Object.isNumber(new Number(1)));
    Assert.isTrue(Object.isString(String.empty));
    Assert.isFalse(Object.isString(new String(String.empty)));
    Assert.isTrue(Object.isSymbol(Symbol("value")));
    Assert.isFalse(Object.isSymbol(Object(Symbol("value"))));
  }

  @TestMethod
  public isFunctionUsesTheJavaScriptFunctionClassification(): void {
    Assert.isTrue(Object.isFunction(() => undefined));
    Assert.isTrue(Object.isFunction(Object));
    Assert.isTrue(Object.isFunction(Map));
    Assert.isFalse(Object.isFunction({}));
  }

  @TestMethod
  public isObjectUsesTheTypeScriptObjectDomain(): void {
    Assert.isTrue(Object.isObject({}));
    Assert.isTrue(Object.isObject([]));
    Assert.isTrue(Object.isObject(() => undefined));
    Assert.isTrue(Object.isObject(Object));
    Assert.isTrue(Object.isObject(Map));
    Assert.isTrue(Object.isObject(new String(String.empty)));
    Assert.isFalse(Object.isObject(null));
    Assert.isFalse(Object.isObject(undefined));
    Assert.isFalse(Object.isObject(String.empty));
    Assert.isFalse(Object.isObject(0));
  }

  @TestMethod
  public classificationGuardsNarrowValues(): void {
    const bigintValue: unknown = 1n;
    const booleanValue: unknown = true;
    const functionValue: unknown = () => undefined;
    const numberValue: unknown = 1;
    const objectValue: unknown = {};
    const stringValue: unknown = "value";
    const symbolValue: unknown = Symbol("value");

    if (!Object.isBigInt(bigintValue)
      || !Object.isBoolean(booleanValue)
      || !Object.isFunction(functionValue)
      || !Object.isNumber(numberValue)
      || !Object.isObject(objectValue)
      || !Object.isString(stringValue)
      || !Object.isSymbol(symbolValue))
      Assert.fail();

    Assert.areEqual(2n, bigintValue + 1n);
    Assert.isTrue(booleanValue);
    Assert.areEqual("function", typeof functionValue);
    Assert.areEqual("[object Object]", objectValue.toString());
    Assert.areEqual(2, numberValue + 1);
    Assert.areEqual(5, stringValue.length);
    Assert.areEqual("value", symbolValue.description);
  }

  @TestMethod
  public classificationExtensionsAreImmutable(): void {
    const names = [
      nameof<ObjectConstructor>(t => t.isBigInt),
      nameof<ObjectConstructor>(t => t.isBoolean),
      nameof<ObjectConstructor>(t => t.isFunction),
      nameof<ObjectConstructor>(t => t.isNumber),
      nameof<ObjectConstructor>(t => t.isObject),
      nameof<ObjectConstructor>(t => t.isString),
      nameof<ObjectConstructor>(t => t.isSymbol)
    ];

    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(Object, name);
      Assert.isDefined(descriptor);
      Assert.areEqual<boolean | undefined>(false, descriptor.writable);
      Assert.areEqual<boolean | undefined>(false, descriptor.enumerable);
      Assert.areEqual<boolean | undefined>(false, descriptor.configurable);
    }
  }

  @TestMethod
  public isNullReturnsTrueForNull(): void {
    Assert.isTrue(Object.isNull(null));
  }

  @TestMethod
  public isNullReturnsFalseForUndefined(): void {
    Assert.isFalse(Object.isNull(undefined));
  }

  @TestMethod
  public isNullReturnsFalseForAValue(): void {
    Assert.isFalse(Object.isNull("value"));
  }

  @TestMethod
  public isNullNarrowsTheValue(): void {
    const value: string | null = "value";

    if (Object.isNull(value))
      Assert.fail();

    Assert.areEqual(5, value.length);
  }

  @TestMethod
  public isNullIsImmutable(): void {
    const descriptor = Object.getOwnPropertyDescriptor(Object, nameof<ObjectConstructor>(t => t.isNull));

    Assert.isDefined(descriptor);
    Assert.areEqual<boolean | undefined>(false, descriptor.writable);
    Assert.areEqual<boolean | undefined>(false, descriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, descriptor.configurable);
  }

  @TestMethod
  public isUndefinedReturnsTrueForUndefined(): void {
    Assert.isTrue(Object.isUndefined(undefined));
  }

  @TestMethod
  public isUndefinedReturnsFalseForNull(): void {
    Assert.isFalse(Object.isUndefined(null));
  }

  @TestMethod
  public isUndefinedReturnsFalseForAValue(): void {
    Assert.isFalse(Object.isUndefined("value"));
  }

  @TestMethod
  public isUndefinedNarrowsTheValue(): void {
    const value: string | undefined = "value";

    if (Object.isUndefined(value))
      Assert.fail();

    Assert.areEqual(5, value.length);
  }

  @TestMethod
  public isUndefinedIsImmutable(): void {
    const descriptor = Object.getOwnPropertyDescriptor(Object, nameof<ObjectConstructor>(t => t.isUndefined));

    Assert.isDefined(descriptor);
    Assert.areEqual<boolean | undefined>(false, descriptor.writable);
    Assert.areEqual<boolean | undefined>(false, descriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, descriptor.configurable);
  }

  @TestMethod
  public isNullOrUndefinedReturnsTrueForNull(): void {
    Assert.isTrue(Object.isNullOrUndefined(null));
  }

  @TestMethod
  public isNullOrUndefinedReturnsTrueForUndefined(): void {
    Assert.isTrue(Object.isNullOrUndefined(undefined));
  }

  @TestMethod
  public isNullOrUndefinedReturnsFalseForZero(): void {
    Assert.isFalse(Object.isNullOrUndefined(0));
  }

  @TestMethod
  public isNullOrUndefinedReturnsFalseForTheEmptyString(): void {
    Assert.isFalse(Object.isNullOrUndefined(String.empty));
  }

  @TestMethod
  public isNullOrUndefinedReturnsFalseForFalse(): void {
    Assert.isFalse(Object.isNullOrUndefined(false));
  }

  @TestMethod
  public isNullOrUndefinedReturnsFalseForNotANumber(): void {
    Assert.isFalse(Object.isNullOrUndefined(Number.NaN));
  }

  @TestMethod
  public isNullOrUndefinedReturnsFalseForAnObject(): void {
    Assert.isFalse(Object.isNullOrUndefined({}));
  }

  @TestMethod
  public isNullOrUndefinedIsImmutable(): void {
    const descriptor = Object.getOwnPropertyDescriptor(Object, nameof<ObjectConstructor>(t => t.isNullOrUndefined));

    Assert.isDefined(descriptor);
    Assert.areEqual<boolean | undefined>(false, descriptor.writable);
    Assert.areEqual<boolean | undefined>(false, descriptor.enumerable);
    Assert.areEqual<boolean | undefined>(false, descriptor.configurable);
  }
}
