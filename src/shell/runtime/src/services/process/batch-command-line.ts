/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { ProcessStartException } from "../../exceptions/process-start.exception.js";
import { ProcessLaunch } from "../../models/process-launch.js";
import { Resources } from "../../resources.js";

export class BatchCommandLine {
  public static create(environment: NodeJS.ProcessEnv, file: string, launchArguments: readonly string[]): ProcessLaunch {
    const systemRoot = environment[Resources.systemRootVariable];
    if (Object.isUndefined(systemRoot) || String.isNullOrWhitespace(systemRoot))
      throw new ProcessStartException(Resources.systemRootMissing);
    if (launchArguments.some(t => Resources.batchUnsafeArgumentPattern.test(t)))
      throw new ProcessStartException(Resources.formatBatchArgumentUnsafe(file));

    const line = [BatchCommandLine.escapeMetacharacters(file), ...launchArguments.map(t => BatchCommandLine.escapeArgument(t))].join(Resources.commandLineSeparator);
    return new ProcessLaunch(
      path.win32.join(systemRoot, Resources.systemFolderName, Resources.commandShellName),
      [...Resources.commandShellArguments, `${Resources.argumentQuote}${line}${Resources.argumentQuote}`],
      true);
  }

  private static escapeArgument(value: string): string {
    const quoted = value
      .replace(Resources.quoteBackslashesPattern, Resources.quoteBackslashesReplacement)
      .replace(Resources.trailingBackslashesPattern, Resources.trailingBackslashesReplacement);
    return BatchCommandLine.escapeMetacharacters(BatchCommandLine.escapeMetacharacters(`${Resources.argumentQuote}${quoted}${Resources.argumentQuote}`));
  }

  private static escapeMetacharacters(value: string): string {
    return value.replace(Resources.batchMetacharacterPattern, Resources.batchMetacharacterEscape);
  }
}
