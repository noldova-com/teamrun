/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LocatedExecutable } from "@noldova/teamrun.providers";

export class FoundAfterInstallCase {
  public readonly name: string;
  public readonly locate: () => LocatedExecutable | null;
  public readonly message: string;

  public constructor(name: string, locate: () => LocatedExecutable | null, message: string) {
    this.name = name;
    this.locate = locate;
    this.message = message;
  }
}
