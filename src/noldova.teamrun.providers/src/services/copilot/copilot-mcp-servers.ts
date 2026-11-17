/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ConfigurationUnreadableException } from "../../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../../resources.js";
import { ConfigurationText } from "../configuration-text.js";

export class CopilotMcpServers {
  public static projectFiles(directory: string): readonly string[] {
    const files: string[] = [];
    let current = resolve(directory);
    for (;;) {
      files.push(join(current, Resources.copilotProjectMcpFile), join(current, Resources.copilotGitHubFolder, Resources.copilotMcpFile));
      const parent = dirname(current);
      if (existsSync(join(current, Resources.copilotGitFolder)) || parent === current)
        return files;
      current = parent;
    }
  }

  public static pluginFolders(home: string): readonly string[] {
    const plugins = join(home, Resources.copilotPluginsFolder);
    return CopilotMcpServers.folders(plugins).flatMap(t => CopilotMcpServers.folders(join(plugins, t)).map(u => join(plugins, t, u)));
  }

  public static pluginFiles(home: string): readonly string[] {
    return CopilotMcpServers.pluginFolders(home).map(t => join(t, Resources.copilotProjectMcpFile));
  }

  public static namesIn(file: string): readonly string[] {
    return CopilotMcpServers.fieldOf(file, CopilotMcpServers.textOf(file), Resources.copilotMcpServersField, t => Object.keys(t));
  }

  public static async namesInAsync(file: string): Promise<readonly string[]> {
    return CopilotMcpServers.fieldOf(file, await CopilotMcpServers.textOfAsync(file), Resources.copilotMcpServersField, t => Object.keys(t));
  }

  public static enabledPlugins(home: string): readonly string[] {
    const file = join(home, Resources.copilotSettingsFile);
    return CopilotMcpServers.fieldOf(file, CopilotMcpServers.textOf(file),
      Resources.copilotEnabledPluginsField, t => Object.entries(t).filter(([, enabled]) => enabled === true).map(([name]) => name));
  }

  private static textOf(file: string): string | null {
    return ConfigurationText.read(file, t => Resources.formatCopilotMcpConfigUnreadable(t), t => Resources.formatCopilotMcpConfigTooLarge(t));
  }

  private static async textOfAsync(file: string): Promise<string | null> {
    return await ConfigurationText.readAsync(file, t => Resources.formatCopilotMcpConfigUnreadable(t), t => Resources.formatCopilotMcpConfigTooLarge(t));
  }

  private static fieldOf(file: string, text: string | null, field: string, names: (value: JsonObject) => readonly string[]): readonly string[] {
    if (Object.isNull(text))
      return [];
    try {
      const reader = JsonReader.parse(text.replace(Resources.copilotCommentLine, String.empty));
      return reader.hasField(field) ? names(reader.readObject(field).toJson()) : [];
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatCopilotMcpConfigUnreadable(file), error);
    }
  }

  private static folders(folder: string): readonly string[] {
    try {
      return readdirSync(folder, { withFileTypes: true }).filter(t => t.isDirectory()).map(t => t.name).sort((a, b) => a.localeCompare(b));
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === Resources.missingFileCode)
        return [];
      throw new ConfigurationUnreadableException(Resources.formatCopilotMcpConfigUnreadable(folder), error);
    }
  }
}
