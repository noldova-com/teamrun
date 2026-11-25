/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LocatedExecutable } from "@noldova/teamrun.providers";

export class UnpackFailureCase {
  public readonly channel: string;
  public readonly archive: Buffer;
  public readonly extractor: LocatedExecutable | null;
  public readonly timeout: number;
  public readonly message: string;

  public constructor(channel: string, archive: Buffer, extractor: LocatedExecutable | null, timeout: number, message: string) {
    this.channel = channel;
    this.archive = archive;
    this.extractor = extractor;
    this.timeout = timeout;
    this.message = message;
  }
}
