/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { AssertFailedException } from "../../exceptions/assert-failed-exception.js";
import { Resources } from "../../resources.js";

export class Assert {
  public static isTrue(condition: boolean, message?: string): asserts condition {
    if (!condition)
      throw new AssertFailedException(message ?? Resources.expectedTrue, true, condition);
  }

  public static isFalse(condition: boolean, message?: string): asserts condition is false {
    if (condition)
      throw new AssertFailedException(message ?? Resources.expectedFalse, false, condition);
  }

  public static areEqual<T>(expected: T, actual: T, message?: string): void {
    if (!Object.is(expected, actual))
      throw new AssertFailedException(message ?? Resources.expectedEqual, expected, actual);
  }

  public static areNotEqual<T>(notExpected: T, actual: T, message?: string): void {
    if (Object.is(notExpected, actual))
      throw new AssertFailedException(message ?? Resources.expectedNotEqual, notExpected, actual);
  }

  public static isNull(value: unknown, message?: string): asserts value is null {
    if (!Object.isNull(value))
      throw new AssertFailedException(message ?? Resources.expectedNull, null, value);
  }

  public static isNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null> {
    if (Object.isNull(value))
      throw new AssertFailedException(message ?? Resources.expectedNotNull, null, value);
  }

  public static isUndefined(value: unknown, message?: string): asserts value is undefined {
    if (!Object.isUndefined(value))
      throw new AssertFailedException(message ?? Resources.expectedUndefined, undefined, value);
  }

  public static isDefined<T>(value: T, message?: string): asserts value is Exclude<T, undefined> {
    if (Object.isUndefined(value))
      throw new AssertFailedException(message ?? Resources.expectedDefined, undefined, value);
  }

  public static isInstanceOf<T>(value: unknown, type: Function & { readonly prototype: T }, message?: string): asserts value is T {
    if (!(value instanceof type))
      throw new AssertFailedException(message ?? Resources.expectedInstanceOf, type.name, value);
  }

  public static throws<TException extends Error>(
    action: () => void,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): TException {
    let didThrow = false;
    let caught: unknown;

    try {
      action();
    }
    catch (error) {
      didThrow = true;
      caught = error;
    }

    if (!didThrow)
      throw new AssertFailedException(message ?? Resources.expectedThrow, exceptionType.name, undefined);

    if (caught instanceof exceptionType)
      return caught;

    throw new AssertFailedException(message ?? Resources.expectedThrowType, exceptionType.name, caught);
  }

  public static async throwsAsync<TException extends Error>(
    action: () => Promise<unknown>,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): Promise<TException> {
    let didThrow = false;
    let caught: unknown;

    try {
      await action();
    }
    catch (error) {
      didThrow = true;
      caught = error;
    }

    if (!didThrow)
      throw new AssertFailedException(message ?? Resources.expectedThrow, exceptionType.name, undefined);

    if (caught instanceof exceptionType)
      return caught;

    throw new AssertFailedException(message ?? Resources.expectedThrowType, exceptionType.name, caught);
  }

  public static doesNotThrow(action: () => void, message?: string): void {
    try {
      action();
    }
    catch (error) {
      throw new AssertFailedException(message ?? Resources.expectedNoThrow, undefined, error);
    }
  }

  public static fail(message?: string): never {
    throw new AssertFailedException(message ?? Resources.assertionFailed);
  }
}
