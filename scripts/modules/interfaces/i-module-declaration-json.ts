/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface IModuleDeclarationJson {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  readonly runtimePackage: string | null;
  readonly cliPackage: string | null;
  readonly contributes: Readonly<Record<string, readonly string[]>>;
  readonly settings: readonly Readonly<Record<string, unknown>>[];
  readonly cliCommands: readonly Readonly<Record<string, unknown>>[];
}
