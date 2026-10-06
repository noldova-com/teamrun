/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class TestIdentity {
  private static readonly SEPARATOR: string = " › ";

  public static of(file: string, names: readonly string[]): string {
    return [file, ...names].join(TestIdentity.SEPARATOR);
  }
}
