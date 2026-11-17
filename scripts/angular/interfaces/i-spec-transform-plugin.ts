/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IVitestPluginContext } from "./i-vitest-plugin-context.ts";

export interface ISpecTransformPlugin {
  readonly name: string;
  readonly enforce: "pre" | "post";

  transform(code: string, id: string): Promise<null> | null;
  configureVitest?(context: IVitestPluginContext): void;
}
