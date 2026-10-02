/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SystemCommand } from "@noldova/teamrun-shell-runtime";

export class SystemCommandFixture extends SystemCommand {
  private readonly outputs: (string | Error | ((commandArguments: readonly string[]) => Promise<string>))[];

  public readonly calls: (readonly string[])[] = [];

  public constructor(outputs: readonly (string | Error | ((commandArguments: readonly string[]) => Promise<string>))[]) {
    super();

    this.outputs = [...outputs];
  }

  public override async runAsync(file: string, commandArguments: readonly string[]): Promise<string> {
    this.calls.push([file, ...commandArguments]);
    const output = this.outputs.shift() ?? "";
    if (output instanceof Error)
      throw output;
    return typeof output === "function" ? await output(commandArguments) : output;
  }
}
