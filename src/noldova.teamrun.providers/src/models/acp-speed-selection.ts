/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AcpConfigOption } from "./acp-config-option.js";

export class AcpSpeedSelection {
  public readonly options: readonly AcpConfigOption[];
  public readonly served: string | null;

  public constructor(options: readonly AcpConfigOption[], served: string | null) {
    this.options = options;
    this.served = served;
  }
}
