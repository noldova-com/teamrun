/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PackageCheckRun {
  public readonly variable: string | undefined;
  public readonly text: string;
  public readonly environments: readonly NodeJS.ProcessEnv[];

  public constructor(variable: string | undefined, text: string, environments: readonly NodeJS.ProcessEnv[]) {
    this.variable = variable;
    this.text = text;
    this.environments = environments;
  }
}
