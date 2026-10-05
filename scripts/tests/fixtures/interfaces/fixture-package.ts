/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IFixturePackage {
  readonly directory: string;
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly peers: Readonly<Record<string, string>>;
}
