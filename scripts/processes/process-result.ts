/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ProcessResult {
  public readonly exitCode: number | null;
  public readonly output: string;
  public readonly errorOutput: string;

  public constructor(exitCode: number | null, output: string, errorOutput: string) {
    this.exitCode = exitCode;
    this.output = output;
    this.errorOutput = errorOutput;
  }

  public get isSuccessful(): boolean {
    return this.exitCode === 0;
  }

  public get text(): string {
    return `${this.output}${this.errorOutput}`.trim();
  }
}
