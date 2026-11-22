/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { ErrorCode, type IMcpToolHost, type McpToolCallParams, type McpToolListParams, McpServer, type Message, MessageIdParams, type RequestedSettings,
  Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { ITurnToolSessions } from "../../interfaces/i-turn-tool-sessions.js";
import { McpEndpoint } from "../../models/mcp-endpoint.js";
import type { MemberToken } from "../../models/member-token.js";
import { ToolReach } from "../../models/tool-reach.js";
import { TurnToolSession } from "../../models/turn-tool-session.js";
import { TurnTools } from "../../models/turn-tools.js";
import type { WorkFolder } from "../../models/work-folder.js";
import { Resources } from "../../resources.js";
import type { EngineServices } from "./engine-services.js";
import { MemberTokens } from "./member-tokens.js";
import type { ReplyRun } from "./reply-run.js";
import { SessionTokens } from "./session-tokens.js";
import type { TurnState } from "./turn-state.js";

export class McpToolCalls {
  private readonly tools: ITurnToolSessions | null;
  private readonly members: MemberTokens;
  private readonly sessionTokens: SessionTokens = new SessionTokens();
  private readonly sessions: TurnToolSession[];
  private readonly toolModeOfAsync: IEngineCallbacks["toolModeOfAsync"];
  private readonly modeIn: IEngineCallbacks["modeIn"];
  private readonly nameOf: IEngineCallbacks["nameOf"];
  private readonly cancelAsync: IEngineCallbacks["cancelAsync"];
  private readonly requireConversationAsync: IEngineCallbacks["requireConversationAsync"];

  public constructor(services: EngineServices, state: TurnState, callbacks: IEngineCallbacks) {
    this.tools = services.tools;
    this.members = new MemberTokens(services.conversations);
    this.sessions = state.sessions;
    this.toolModeOfAsync = callbacks.toolModeOfAsync;
    this.modeIn = callbacks.modeIn;
    this.nameOf = callbacks.nameOf;
    this.cancelAsync = callbacks.cancelAsync;
    this.requireConversationAsync = callbacks.requireConversationAsync;
  }

  public async stopSessionAsync(session: string, reason: string): Promise<void> {
    const open = this.sessions.find(t => t.session.id === session);
    if (Object.isUndefined(open))
      return;
    open.stopped = true;
    open.stops.abort(new Error(reason));
    open.run.noteStop(reason);
    await this.cancelAsync(new MessageIdParams(open.reply.id));
  }

  public async listMcpToolsAsync(params: McpToolListParams, signal: AbortSignal = new AbortController().signal): Promise<readonly JsonObject[]> {
    const { member, open } = await this.reachOfAsync(params.token);
    if (Object.isNull(member))
      throw new ServiceException(ErrorCode.Unauthorized, Resources.mcpTokenRefused, []);
    if (Object.isNull(open))
      throw new ServiceException(ErrorCode.Unavailable, Resources.mcpNoRunningTurn, []);

    let listed: readonly JsonObject[];
    try {
      listed = await open.session.listToolsAsync(signal);
    }
    catch (error) {
      open.tools.markFailed(error);
      throw error;
    }
    open.tools.markListed();
    return listed;
  }

  public async callMcpToolAsync(params: McpToolCallParams, signal: AbortSignal = new AbortController().signal): Promise<JsonObject> {
    const { member, open } = await this.reachOfAsync(params.token);
    if (Object.isNull(member))
      return McpServer.toolError(ProtocolResources.formatMcpToolFailure(Resources.deniedFailure, null, Resources.mcpTokenRefused));

    return this.callToolIn(open, params.name, params.arguments, signal);
  }

  public async acceptsSessionTokenAsync(token: string): Promise<boolean> {
    return !Object.isNull(await this.memberOfSessionAsync(token));
  }

  public senderTokenOf(session: string): string | null {
    return this.sessions.find(t => t.session.id === session)?.sender ?? null;
  }

  public async openToolsAsync(reply: Message, run: ReplyRun, sender: string | null, folder: WorkFolder, requested: RequestedSettings): Promise<TurnTools | null> {
    if (Object.isNull(this.tools))
      return null;
    const token = await this.members.issueAsync(reply.conversationId, reply.teammateId);
    const projectId = (await this.requireConversationAsync(reply.conversationId)).projectId;
    const scope = Resources.formatToolScope(reply.conversationId, reply.teammateId);
    const host: IMcpToolHost = {
      listToolsAsync: signal => this.listToolsOf(scope, signal),
      callToolAsync: (name, input, signal) => this.callToolOf(scope, name, input, signal)
    };
    const session = this.tools.open(scope, reply.conversationId, folder.path, projectId,
      this.nameOf(reply), call => run.noteToolCall(call));
    const endpoint = Object.isNull(this.tools.endpoint) ? null : new McpEndpoint(this.tools.endpoint, this.sessionTokens, session.id);
    const tools = new TurnTools(host, this.tools.approvedTools, endpoint);
    this.sessionTokens.open(session.id, token);
    this.sessions.push(new TurnToolSession(scope, token, session, tools, run, sender, reply, this.modeIn(requested)));
    return tools;
  }

  public closeTools(tools: TurnTools | null): void {
    const closed = this.sessions.find(t => t.tools === tools);
    if (Object.isUndefined(closed))
      return;
    this.sessions.splice(this.sessions.indexOf(closed), 1);
    this.sessionTokens.close(closed.session.id);
    closed.stops.abort(new Error(Resources.mcpTurnStopped));
    closed.session.end();
  }

  private latestOpenOf(scope: string): TurnToolSession | null {
    return this.sessions.findLast(t => t.scope === scope) ?? null;
  }

  private async reachOfAsync(token: string): Promise<ToolReach> {
    const owner = await this.memberOfSessionAsync(token);
    const session = Object.isNull(owner) ? null : this.sessionTokens.find(token);
    return new ToolReach(owner, this.sessions.find(t => t.session.id === session) ?? null);
  }

  private async memberOfSessionAsync(token: string): Promise<MemberToken | null> {
    const owner = this.sessionTokens.ownerOf(token);
    return Object.isNull(owner) ? null : await this.members.findAsync(owner);
  }

  private async listToolsOf(scope: string, signal: AbortSignal): Promise<readonly JsonObject[]> {
    const open = this.latestOpenOf(scope);
    if (Object.isNull(open))
      throw new ServiceException(ErrorCode.Unavailable, Resources.mcpNoRunningTurn, []);

    return open.session.listToolsAsync(signal);
  }

  private async callToolOf(scope: string, name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    return this.callToolIn(this.latestOpenOf(scope), name, input, signal);
  }

  private async callToolIn(open: TurnToolSession | null, name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    if (Object.isNull(open))
      return McpServer.toolError(ProtocolResources.formatMcpToolFailure(Resources.unavailableFailure, Resources.noRunningTurnCode, Resources.mcpNoRunningTurn));
    if (this.hasStopped(open))
      return McpToolCalls.turnStopped();
    const mode = await this.toolModeOfAsync(open);
    if (mode?.readOnly === true && !(await open.session.listToolsAsync(signal))
      .some(t => t["name"] === name && McpToolCalls.isReadOnly(t)))
      return McpServer.toolError(ProtocolResources.formatMcpToolFailure(Resources.deniedFailure, Resources.readOnlyModeCode, Resources.formatReadOnlyModeRefused(name, mode.name)));
    if (this.hasStopped(open))
      return McpToolCalls.turnStopped();

    return open.session.callToolAsync(name, input, AbortSignal.any([signal, open.stops.signal]));
  }

  private hasStopped(open: TurnToolSession): boolean {
    return open.stopped || !this.sessions.some(t => t.session === open.session);
  }

  private static isReadOnly(tool: JsonObject): boolean {
    const annotations = tool["annotations"];
    return McpToolCalls.isJsonObject(annotations) && annotations["readOnlyHint"] === true;
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static turnStopped(): JsonObject {
    return McpServer.toolError(ProtocolResources.formatMcpToolFailure(Resources.unavailableFailure, Resources.turnStoppedCode, Resources.mcpTurnStopped));
  }
}
