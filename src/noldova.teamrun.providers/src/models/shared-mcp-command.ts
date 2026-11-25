/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SharedMcpCommand {
  public readonly command: string;
  public readonly args: string[];
  public readonly verbatim: boolean;

  public constructor(command: string, args: readonly string[], verbatim: boolean) {
    this.command = command;
    this.args = [...args];
    this.verbatim = verbatim;
  }
}
