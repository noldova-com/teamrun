/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { resolve } from "node:path";

import { MethodName, Project, ProjectOpenParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ProjectOpenCommand extends RuntimeCommand {
  public readonly name: string = Resources.projectOpenCommand;
  public readonly description: string = Resources.projectOpenDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const params = new ProjectOpenParams(resolve(context.commandLine.requirePositional(0, Resources.pathArgument)));
    output.writeObject(await session.call(MethodName.ProjectOpen, params.toJson()), t => this.formatter.formatProject(Project.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
