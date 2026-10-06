/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { CliCommandResult, type ICliPart, type ICliPartContext } from "@noldova/teamrun-shell-cli";

import { Resources } from "./resources.js";

export class CliPart implements ICliPart {
  public async activateAsync(context: ICliPartContext): Promise<void> {
    context.registerCommand(Resources.showTimeCommand, {
      handleAsync: async (values, signal) => {
        const answer = await context.requestAsync(Resources.timeMethod, null, signal);
        const time = JsonReader.fromValue(answer).readString(Resources.timeField);
        return new CliCommandResult(answer, Resources.formatTime(String(values[Resources.prefixOption]), time));
      }
    });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
