/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { MethodName, ProjectListing } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class ProjectsCommand extends TeamRunCommand {
  public readonly name: string = Resources.projectsCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(_values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const projects = await this.client.listAsync(MethodName.ProjectList, null, signal, t => ProjectListing.fromJson(t).project);
    return new CliCommandResult(projects.map(t => t.toJson()), Resources.formatList(projects.map(t => Resources.formatProject(t))));
  }
}
