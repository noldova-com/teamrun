/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { ManagedProfile } from "../acp/managed-profile.js";
import { CursorPermissions } from "./cursor-permissions.js";

export class CursorProfile {
  private readonly profile: ManagedProfile;

  public readonly directory: string;
  public readonly folders: Readonly<Record<string, string>>;
  public readonly titleHomes: Readonly<Record<string, string>>;

  public constructor(directory: string, platform: string = process.platform) {
    this.profile = new ManagedProfile(directory, Resources.cursorProfileMarkerValue, Resources.cursorProfileAbsolute, Resources.cursorProfileNotManaged);
    this.directory = directory;
    this.folders = Object.fromEntries(Object.entries(Resources.cursorSignInVariables(platform))
      .map(([name, path]) => [name, join(directory, ...path.split(Resources.cursorFolderSeparator))]));
    this.titleHomes = Object.fromEntries(Resources.cursorTitleHomeVariables(platform).map(t => [t, join(directory, Resources.cursorTitleHomeFolder)]));
  }

  public prepare(approvedTools: readonly string[] = [], permissions: CursorPermissions = CursorPermissions.none): void {
    this.profile.prepare();
    for (const folder of [...Object.values(this.folders), ...Object.values(this.titleHomes)])
      mkdirSync(folder, { recursive: true });
    this.profile.writeFile(Resources.cursorConfigFileName, Resources.formatCursorConfig(ProtocolResources.mcpServerName,
      approvedTools.filter(t => Resources.approvedToolNamePattern.test(t)), permissions.allow, permissions.deny));
  }
}
