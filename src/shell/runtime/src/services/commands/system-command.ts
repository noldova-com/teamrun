/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import { Resources } from "../../resources.js";

export class SystemCommand {
  public runAsync(file: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv = process.env): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      execFile(
        file,
        [...commandArguments],
        {
          encoding: Resources.utf8Encoding,
          env: environment,
          maxBuffer: Resources.commandOutputLimit,
          shell: false,
          timeout: Resources.commandTimeoutMilliseconds,
          windowsHide: true
        },
        (error, output) => {
          if (Object.isNull(error))
            resolve(output);
          else
            reject(new SystemCommandException(Resources.formatCommandFailed(file, error.message), new ExceptionOptions(error)));
        });
    });
  }
}
