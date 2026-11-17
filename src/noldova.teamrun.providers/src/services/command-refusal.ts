/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { TurnRequest } from "@noldova/teamrun.core";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { AcpCommands } from "./acp/acp-commands.js";

export class CommandRefusal {
  public static of(displayName: string, request: TurnRequest, reasonOf: (name: string) => string | null): string | null {
    const command = request.compacts ? null : request.command;
    const reason = Object.isNull(command) ? null : reasonOf(AcpCommands.nameOf(command));
    return Object.isNull(command) || Object.isNull(reason) ? null
      : ProtocolResources.formatAbilityRefused(displayName, Resources.formatRunCommand(AcpCommands.shownOf(command)), reason);
  }
}
