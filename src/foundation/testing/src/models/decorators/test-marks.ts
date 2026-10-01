/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TestMarks {
  public static readonly CATEGORY: unique symbol = Symbol("Noldova.TeamRun.Testing.Category");
  public static readonly TEST_CLASS: unique symbol = Symbol("Noldova.TeamRun.Testing.TestClass");
  public static readonly TEST_DATA: unique symbol = Symbol("Noldova.TeamRun.Testing.TestData");
  public static readonly TEST_METHOD: unique symbol = Symbol("Noldova.TeamRun.Testing.TestMethod");
  public static readonly SKIP: unique symbol = Symbol("Noldova.TeamRun.Testing.Skip");
}
