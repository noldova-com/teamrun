/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, Teammate, TeammateUpdateParams, Harness } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class TeammateUpdateCommand extends RuntimeCommand {
  public readonly name: string = Resources.teammateUpdateCommand;
  public readonly description: string = Resources.teammateUpdateDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const id = context.commandLine.requirePositional(0, Resources.idArgument);
    const name = context.commandLine.requirePositional(1, Resources.teammateNameArgument);
    const account = context.commandLine.requirePositional(2, Resources.accountOption);
    const params = new TeammateUpdateParams(id, name, context.commandLine.option(Resources.roleOption), account, Harness.Provider,
      context.commandLine.option(Resources.modelOption), context.commandLine.option(Resources.effortOption));
    const updated = await session.call(MethodName.TeammateUpdate, params.toJson());
    output.writeObject(updated, t => this.formatter.formatTeammate(Teammate.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
