/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConversationResponder, Teammate } from "@noldova/teamrun.protocol";

export class UsableResponder {
  public readonly responder: ConversationResponder;
  public readonly teammate: Teammate | null;

  public constructor(responder: ConversationResponder, teammate: Teammate | null) {
    this.responder = responder;
    this.teammate = teammate;
  }
}
