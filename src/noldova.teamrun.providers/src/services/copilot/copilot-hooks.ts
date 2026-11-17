/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { ConfigurationText } from "../configuration-text.js";
import { CopilotMcpServers } from "./copilot-mcp-servers.js";

export class CopilotHooks {
  public static policyFolder(platform: string, environment: NodeJS.ProcessEnv): string {
    const named = environment[Resources.programDataVariable];
    return platform !== Resources.windowsPlatform ? Resources.copilotPolicyFolder
      : join(Object.isUndefined(named) || String.isNullOrWhitespace(named) ? Resources.windowsProgramData : named, ...Resources.copilotWindowsPolicySegments);
  }

  public static presentIn(home: string, policyFolder: string): boolean {
    try {
      return CopilotHooks.hookFiles(policyFolder).length > 0 || CopilotHooks.hookFiles(join(home, Resources.copilotHooksFolder)).length > 0
        || CopilotMcpServers.pluginFolders(home).some(t => Resources.copilotPluginHookFiles.some(u => existsSync(join(t, ...u))))
        || CopilotHooks.inSettings(join(home, Resources.copilotSettingsFile));
    }
    catch {
      return true;
    }
  }

  private static hookFiles(folder: string): readonly string[] {
    try {
      return readdirSync(folder, { withFileTypes: true }).filter(t => t.isFile() && t.name.endsWith(Resources.copilotHookFileExtension)).map(t => t.name);
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === Resources.missingFileCode)
        return [];
      throw error;
    }
  }

  private static inSettings(file: string): boolean {
    const text = ConfigurationText.read(file, t => Resources.formatCopilotMcpConfigUnreadable(t), t => Resources.formatCopilotMcpConfigTooLarge(t));
    if (Object.isNull(text))
      return false;
    const settings = JsonReader.parse(text.replace(Resources.copilotCommentLine, String.empty));
    return settings.hasField(Resources.copilotHooksField) && Object.keys(settings.readObject(Resources.copilotHooksField).toJson()).length > 0;
  }
}
