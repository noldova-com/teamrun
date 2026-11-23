/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MemberToken } from "./member-token.js";
import type { TurnToolSession } from "./turn-tool-session.js";

export class ToolReach {
  public readonly member: MemberToken | null;
  public readonly open: TurnToolSession | null;

  public constructor(member: MemberToken | null, open: TurnToolSession | null) {
    this.member = member;
    this.open = open;
  }
}
