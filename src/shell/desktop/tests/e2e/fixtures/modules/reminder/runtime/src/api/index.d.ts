/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";

export declare class RuntimePart implements IRuntimePart {
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  public deactivateAsync(): Promise<void>;
}
