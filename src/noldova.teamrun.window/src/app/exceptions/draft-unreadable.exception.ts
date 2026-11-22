/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class DraftUnreadableException extends WindowException {
  public override readonly name: string = "DraftUnreadableException";
  public readonly conversationId: string;

  public constructor(conversationId: string, cause: Error) {
    super(Resources.formatDraftUnreadable(cause.message), cause);
    this.conversationId = conversationId;
  }
}
