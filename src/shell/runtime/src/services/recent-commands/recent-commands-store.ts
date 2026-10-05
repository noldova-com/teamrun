/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RecentCommands, type RecentCommandUse } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class RecentCommandsStore {
  private readonly database: ShellDatabase;

  public constructor(database: ShellDatabase) {
    this.database = database;
  }

  public read(device: string): RecentCommands {
    return new RecentCommands(this.database.readAll(Resources.readRecentCommandsStatement, device).map(t => String(t[Resources.idColumn])), device);
  }

  public record(use: RecentCommandUse): RecentCommands {
    this.database.run(Resources.recordRecentCommandStatement, use.device, use.id);
    this.database.run(Resources.trimRecentCommandsStatement, use.device, Resources.maximumRecentCommands);
    return this.read(use.device);
  }
}
