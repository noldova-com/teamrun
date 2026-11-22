/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AttachmentInput } from "@noldova/teamrun.protocol";

import type { ComposerSettings } from "./composer-settings";

export class ComposerFanOut {
  public readonly send: (text: string, settings: ComposerSettings, attachments: readonly AttachmentInput[], sources: readonly string[]) => Promise<boolean>;

  public constructor(send: (text: string, settings: ComposerSettings, attachments: readonly AttachmentInput[], sources: readonly string[]) => Promise<boolean>) {
    this.send = send;
  }
}
