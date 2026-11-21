/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IScreenshotOptions } from "./i-screenshot-options.ts";
import type { ITakenScreenshot } from "./i-taken-screenshot.ts";
import type { IVitestPluginContext } from "./i-vitest-plugin-context.ts";

export interface IScreenshotCommandContext {
  readonly project: IVitestPluginContext;

  triggerCommand(command: string, name: string, options: IScreenshotOptions): Promise<ITakenScreenshot>;
}
