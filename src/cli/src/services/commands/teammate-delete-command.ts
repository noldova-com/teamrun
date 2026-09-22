/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, TeammateIdParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class TeammateDeleteCommand extends RuntimeCommand {
  public readonly name: string = Resources.teammateDeleteCommand;
  public readonly description: string = Resources.teammateDeleteDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const id = context.commandLine.requirePositional(0, Resources.idArgument);
    output.writeText(id, await session.call(MethodName.TeammateDelete, new TeammateIdParams(id).toJson()));
    return Resources.exitSuccess;
  }
}
