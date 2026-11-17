/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { OwnMcpServer, OwnMcpServerState, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { IAcpOwnMcpServersReader } from "../../interfaces/i-acp-own-mcp-servers.reader.js";
import { Resources } from "../../resources.js";

export class GrokMcpServersReader implements IAcpOwnMcpServersReader {
  public readonly methods: readonly string[] = Resources.xaiMcpListMethods;

  public read(answer: JsonValue): readonly OwnMcpServer[] {
    const reader = JsonReader.fromValue(answer);
    const servers = Object.isNullOrUndefined(reader.toJson()[Resources.serversField]) ? [] : reader.readObjectArray(Resources.serversField);
    const names = servers.map(t => t.readNonBlankString(Resources.nameField));
    return [...new Set(names)].filter(t => t !== ProtocolResources.mcpServerName).map(t => new OwnMcpServer(t, OwnMcpServerState.Configured));
  }
}
