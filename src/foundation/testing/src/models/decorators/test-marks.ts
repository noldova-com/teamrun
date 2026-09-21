/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TestMarks {
  public static readonly CATEGORY: unique symbol = Symbol("Noldova.Context.Testing.Category");
  public static readonly TEST_CLASS: unique symbol = Symbol("Noldova.Context.Testing.TestClass");
  public static readonly TEST_DATA: unique symbol = Symbol("Noldova.Context.Testing.TestData");
  public static readonly TEST_METHOD: unique symbol = Symbol("Noldova.Context.Testing.TestMethod");
  public static readonly SKIP: unique symbol = Symbol("Noldova.Context.Testing.Skip");
}
