/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IVitestLogger from "./vitest-logger.ts";

export default interface IVitestRun {
  readonly logger: IVitestLogger;

  onClose(listener: () => void): void;
}
