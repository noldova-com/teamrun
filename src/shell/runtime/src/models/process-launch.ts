/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessLaunch {
  public readonly executable: string;
  public readonly arguments: readonly string[];
  public readonly isVerbatim: boolean;

  public constructor(executable: string, launchArguments: readonly string[], isVerbatim: boolean) {
    this.executable = executable;
    this.arguments = [...launchArguments];
    this.isVerbatim = isVerbatim;
  }
}
