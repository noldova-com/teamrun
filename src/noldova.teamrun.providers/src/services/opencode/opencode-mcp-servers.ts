/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { ConfigurationUnreadableException } from "../../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../../resources.js";
import { ConfigurationText } from "../configuration-text.js";
import { UsualFolder } from "../usual-folder.js";

export class OpencodeMcpServers {
  public static files(environment: NodeJS.ProcessEnv, directory: string, platform: string = process.platform): readonly string[] {
    const home = UsualFolder.home(environment, platform);
    const global = join(UsualFolder.of(environment, Resources.xdgConfigVariable, Resources.opencodeUsualConfigFolder, home), Resources.opencodeConfigFolder);
    const named = OpencodeMcpServers.pathOf(environment, Resources.opencodeConfigVariable, directory);
    const folder = OpencodeMcpServers.pathOf(environment, Resources.opencodeConfigDirVariable, directory);
    const projectOff = Resources.opencodeTrueValues.includes(environment[Resources.opencodeDisableProjectConfigVariable]?.toLowerCase() ?? String.empty);
    return [
      ...Resources.opencodeGlobalConfigFiles.map(t => join(global, t)),
      ...(Object.isNull(named) ? [] : [named]),
      ...(projectOff ? [] : OpencodeMcpServers.projectFiles(directory)),
      ...Resources.opencodeConfigFiles.map(t => join(home, Resources.opencodeDotFolder, t)),
      ...(Object.isNull(folder) ? [] : Resources.opencodeConfigFiles.map(t => join(folder, t))),
      ...Resources.opencodeConfigFiles.map(t => join(OpencodeMcpServers.managedFolder(environment, directory, platform), t))
    ];
  }

  public static names(environment: NodeJS.ProcessEnv, directory: string, platform: string = process.platform): readonly string[] {
    const names = OpencodeMcpServers.files(environment, directory, platform).flatMap(t => OpencodeMcpServers.namesIn(t,
      ConfigurationText.read(t, u => Resources.formatOpencodeMcpConfigUnreadable(u), u => Resources.formatOpencodeMcpConfigTooLarge(u))));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }

  private static jsonOf(text: string): string {
    return OpencodeMcpServers.scan(OpencodeMcpServers.scan(text, rest => OpencodeMcpServers.commentLength(rest)),
      rest => Resources.opencodeTrailingComma.test(rest) ? 1 : 0);
  }

  private static pathOf(environment: NodeJS.ProcessEnv, variable: string, directory: string): string | null {
    const value = OpencodeMcpServers.valueOf(environment, variable);
    return Object.isNull(value) ? null : resolve(directory, value);
  }

  private static valueOf(environment: NodeJS.ProcessEnv, variable: string): string | null {
    const value = environment[variable];
    return Object.isUndefined(value) || String.isNullOrWhitespace(value) ? null : value;
  }

  private static managedFolder(environment: NodeJS.ProcessEnv, directory: string, platform: string): string {
    const named = OpencodeMcpServers.pathOf(environment, Resources.opencodeManagedConfigDirVariable, directory);
    if (!Object.isNull(named))
      return named;
    if (platform === Resources.macPlatform)
      return Resources.opencodeMacManagedFolder;
    if (platform === Resources.windowsPlatform)
      return join(OpencodeMcpServers.valueOf(environment, Resources.programDataVariable) ?? Resources.windowsProgramData, Resources.opencodeConfigFolder);
    return Resources.opencodeLinuxManagedFolder;
  }

  private static projectFiles(directory: string): readonly string[] {
    const files: string[] = [];
    let current = resolve(directory);
    for (;;) {
      files.push(...Resources.opencodeConfigFiles.map(t => join(current, t)),
        ...Resources.opencodeConfigFiles.map(t => join(current, Resources.opencodeDotFolder, t)));
      const parent = dirname(current);
      if (existsSync(join(current, Resources.gitDirectoryName)) || parent === current)
        return files;
      current = parent;
    }
  }

  private static namesIn(file: string, text: string | null): readonly string[] {
    if (Object.isNull(text))
      return [];
    try {
      const reader = JsonReader.parse(OpencodeMcpServers.jsonOf(text));
      return reader.hasField(Resources.opencodeMcpField) ? Object.keys(reader.readObject(Resources.opencodeMcpField).toJson()) : [];
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatOpencodeMcpConfigUnreadable(file), error);
    }
  }

  private static commentLength(rest: string): number {
    if (rest.startsWith(Resources.opencodeLineComment)) {
      const end = rest.indexOf(Resources.opencodeLineEnd);
      return end < 0 ? rest.length : end;
    }
    if (rest.startsWith(Resources.opencodeBlockCommentStart)) {
      const end = rest.indexOf(Resources.opencodeBlockCommentEnd, Resources.opencodeBlockCommentStart.length);
      return end < 0 ? rest.length : end + Resources.opencodeBlockCommentEnd.length;
    }
    return 0;
  }

  private static scan(text: string, skipped: (rest: string) => number): string {
    let kept = String.empty;
    let index = 0;
    while (index < text.length) {
      if (text.charAt(index) === Resources.opencodeQuote) {
        const end = OpencodeMcpServers.stringEnd(text, index);
        kept += text.slice(index, end);
        index = end;
        continue;
      }
      const skip = skipped(text.slice(index));
      if (skip > 0) {
        index += skip;
        continue;
      }
      kept += text.charAt(index);
      index += 1;
    }
    return kept;
  }

  private static stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length) {
      const character = text.charAt(index);
      if (character === Resources.opencodeEscape)
        index += 2;
      else if (character === Resources.opencodeQuote)
        return index + 1;
      else
        index += 1;
    }
    return text.length;
  }
}
