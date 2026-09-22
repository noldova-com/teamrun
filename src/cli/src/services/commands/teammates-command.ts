/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, Teammate } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class TeammatesCommand extends RuntimeCommand {
  public readonly name: string = Resources.teammatesCommand;
  public readonly description: string = Resources.teammatesDescription;

  protected override async execute(session: RuntimeSession, _context: CommandContext, output: OutputWriter): Promise<number> {
    const listed = await session.call(MethodName.TeammateList, null);
    output.writeObjects(listed, t => this.formatter.formatTeammate(Teammate.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
