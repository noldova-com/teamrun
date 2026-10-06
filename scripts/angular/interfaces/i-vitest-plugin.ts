/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type MarkedModule from "../marked-module.ts";
import type IVitestPluginContext from "./i-vitest-plugin-context.ts";

export default interface IVitestPlugin {
  readonly name: string;
  readonly enforce: "post";

  transform(code: string, id: string): MarkedModule | null;
  configureVitest(context: IVitestPluginContext): void;
}
