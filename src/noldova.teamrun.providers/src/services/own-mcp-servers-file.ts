/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { OwnMcpServer, OwnMcpServerState, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { ConfigurationUnreadableException } from "../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../resources.js";
import { ConfigurationText } from "./configuration-text.js";

export class OwnMcpServersFile {
  public static async listInAsync(file: string, refusal: (reader: JsonReader) => string | null = () => null): Promise<readonly OwnMcpServer[]> {
    const text = await ConfigurationText.readAsync(file, t => Resources.formatOwnMcpConfigUnreadable(t), t => Resources.formatOwnMcpConfigTooLarge(t));
    return OwnMcpServersFile.namesIn(file, text, refusal).filter(t => t !== ProtocolResources.mcpServerName).map(t => new OwnMcpServer(t, OwnMcpServerState.Configured));
  }

  private static namesIn(file: string, text: string | null, refusal: (reader: JsonReader) => string | null): readonly string[] {
    if (Object.isNull(text))
      return [];
    const reader = OwnMcpServersFile.parsed(file, text);
    const refused = refusal(reader);
    if (!Object.isNull(refused))
      throw new ConfigurationUnreadableException(refused);
    try {
      return reader.hasField(Resources.ownMcpServersField) ? Object.keys(reader.readObject(Resources.ownMcpServersField).toJson()) : [];
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatOwnMcpConfigUnreadable(file), error);
    }
  }

  private static parsed(file: string, text: string): JsonReader {
    try {
      return JsonReader.parse(text);
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatOwnMcpConfigUnreadable(file), error);
    }
  }
}
