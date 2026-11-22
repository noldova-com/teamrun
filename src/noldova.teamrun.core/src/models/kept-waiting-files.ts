/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { MessageAttachment, MessageSendParams } from "@noldova/teamrun.protocol";

export class KeptWaitingFiles {
  public readonly message: MessageSendParams;
  public readonly files: readonly MessageAttachment[];

  public constructor(message: MessageSendParams, files: readonly MessageAttachment[]) {
    this.message = message;
    this.files = files;
  }
}
