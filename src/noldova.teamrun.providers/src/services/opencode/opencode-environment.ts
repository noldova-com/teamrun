/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";

export class OpencodeEnvironment {
  public static build(base: NodeJS.ProcessEnv, dataFolder: string, added: boolean, mode: string | null = null, approvedTools: readonly string[] = [],
    ownTools: boolean = false, serversOff: readonly string[] | null = null): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, added ? Resources.opencodeAddedExcludedEnvironment : Resources.opencodeExcludedEnvironment);
    const server = ProtocolResources.mcpServerName;
    const approved = approvedTools.filter(t => Resources.approvedToolNamePattern.test(t));
    const allowAll = mode === Resources.opencodeAllowAllMode ? Resources.opencodeAllowAllRules(server, ownTools, false) : null;
    const chat = allowAll ?? Resources.opencodeAskRules(server, approved, mode === Resources.opencodePlanMode);
    const subAgents = allowAll ?? Resources.opencodeSubAgentRules(server, approved);
    const others = allowAll === null ? Resources.opencodeRefuseRules(server, approved, ownTools) : Resources.opencodeAllowAllRules(server, ownTools, true);
    const own = OpencodeEnvironment.objectOf(environment[Resources.opencodePermissionVariable]);
    const content = environment[Resources.opencodeConfigContentVariable];
    const read = { [Resources.opencodeReadTool]: { ...OpencodeEnvironment.fieldOf(OpencodeEnvironment.fieldOf(OpencodeEnvironment.objectOf(content), Resources.opencodePermissionField),
      Resources.opencodeReadTool), ...OpencodeEnvironment.fieldOf(own, Resources.opencodeReadTool) } };
    environment[Resources.xdgDataVariable] = dataFolder;
    if (!Object.isNull(serversOff))
      environment[Resources.opencodePureVariable] = Resources.opencodePureValue;
    environment[Resources.opencodePermissionVariable] = JSON.stringify(OpencodeEnvironment.merged(own, others));
    environment[Resources.opencodeConfigContentVariable] = JSON.stringify(OpencodeEnvironment.withServersOff(OpencodeEnvironment.withAgentRules(content,
      OpencodeEnvironment.merged(read, chat), OpencodeEnvironment.merged(read, subAgents)), serversOff));
    return environment;
  }

  private static withAgentRules(own: string | undefined, chat: Readonly<Record<string, unknown>>, subAgents: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const config = OpencodeEnvironment.objectOf(own);
    const chats = { ...Resources.opencodeChatAgentState, [Resources.opencodePermissionField]: chat };
    const pinned = (field: string, names: readonly string[], fields: Readonly<Record<string, unknown>>): Record<string, unknown> => Object.fromEntries(names
      .map(t => [t, { ...OpencodeEnvironment.fieldOf(OpencodeEnvironment.fieldOf(config, field), t), ...fields }]));
    return { ...config,
      [Resources.opencodeAgentField]: { ...OpencodeEnvironment.fieldOf(config, Resources.opencodeAgentField), ...pinned(Resources.opencodeAgentField, Resources.opencodeChatAgents, chats),
        ...pinned(Resources.opencodeAgentField, Resources.opencodeSubAgents, { [Resources.opencodePermissionField]: subAgents }) },
      [Resources.opencodeModeField]: { ...OpencodeEnvironment.fieldOf(config, Resources.opencodeModeField), ...pinned(Resources.opencodeModeField, Resources.opencodeChatAgents, chats) } };
  }

  private static withServersOff(config: Record<string, unknown>, names: readonly string[] | null): Record<string, unknown> {
    if (Object.isNull(names))
      return config;
    const servers = OpencodeEnvironment.fieldOf(config, Resources.opencodeMcpField);
    const off = [...new Set([...names, ...Object.keys(servers)])];
    return off.length === 0 ? config : { ...config, [Resources.opencodeMcpField]: { ...servers,
      ...Object.fromEntries(off.map(t => [t, { ...OpencodeEnvironment.fieldOf(servers, t), [Resources.opencodeEnabledField]: false }])) } };
  }

  private static merged(under: Record<string, unknown>, over: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const result: Record<string, unknown> = Object.keys(over)[0] === "*" ? { "*": over["*"], ...under } : { ...under };
    for (const [name, value] of Object.entries(over)) {
      const kept = result[name];
      result[name] = OpencodeEnvironment.isObject(kept) && OpencodeEnvironment.isObject(value) ? OpencodeEnvironment.merged(kept, value) : value;
    }
    return result;
  }

  private static objectOf(text: string | undefined): Record<string, unknown> {
    if (Object.isUndefined(text))
      return {};
    try {
      return OpencodeEnvironment.fieldOf({ value: JSON.parse(text) as unknown }, "value");
    }
    catch {
      return {};
    }
  }

  private static fieldOf(value: Record<string, unknown>, name: string): Record<string, unknown> {
    const field = value[name];
    return OpencodeEnvironment.isObject(field) ? field : {};
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }
}
