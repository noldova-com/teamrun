/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageAttachment } from "@noldova/teamrun.protocol";

export class TurnSteer {
  public readonly text: string;
  public readonly attachments: readonly MessageAttachment[];

  public constructor(text: string, attachments: readonly MessageAttachment[]) {
    this.text = text;
    this.attachments = attachments;
  }
}
