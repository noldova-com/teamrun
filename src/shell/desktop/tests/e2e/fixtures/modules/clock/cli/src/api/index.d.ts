/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliPart, ICliPartContext } from "@noldova/teamrun-shell-cli";

export declare class CliPart implements ICliPart {
  public activateAsync(context: ICliPartContext): Promise<void>;

  public deactivateAsync(): Promise<void>;
}
