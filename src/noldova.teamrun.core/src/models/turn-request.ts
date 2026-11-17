/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { MessageAttachment, Provider, RequestedSettings, SharedMcpServerDefinition } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { SharedMcpValues } from "./shared-mcp-values.js";
import type { TurnTools } from "./turn-tools.js";

export class TurnRequest {
  public readonly provider: Provider | null;
  public readonly workingDirectory: string;
  public readonly prompt: string;
  public readonly requested: RequestedSettings;
  public readonly resumeNativeSessionId: string | null;
  public readonly attachments: readonly MessageAttachment[];
  public readonly instructions: string | null;
  public readonly freshPrompt: string | null;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly compacts: boolean;
  public readonly tools: TurnTools | null;
  public readonly sharedServers: readonly SharedMcpServerDefinition[];
  public readonly resumeAt: string | null;
  public readonly sharedValues: SharedMcpValues;
  public readonly instructionsWithoutTools: string | null;
  public readonly isolated: boolean;
  public readonly command: string | null;
  public readonly compactsWhenIdle: boolean;
  private readonly senderAdopter: (token: string) => boolean;

  public constructor(
    provider: Provider | null,
    workingDirectory: string,
    prompt: string,
    requested: RequestedSettings,
    resumeNativeSessionId: string | null,
    attachments: readonly MessageAttachment[] = [],
    instructions: string | null = null,
    freshPrompt: string | null = null,
    environment: Readonly<Record<string, string>> = {},
    compacts: boolean = false,
    tools: TurnTools | null = null,
    sharedServers: readonly SharedMcpServerDefinition[] = [],
    resumeAt: string | null = null,
    adoptSender: (token: string) => boolean = () => false,
    sharedValues: SharedMcpValues = SharedMcpValues.none,
    instructionsWithoutTools: string | null = null,
    isolated: boolean = false,
    command: string | null = null,
    compactsWhenIdle: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(workingDirectory, Resources.workingDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(prompt, Resources.promptParameterName);
    if (!Object.isNull(resumeNativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(resumeNativeSessionId, Resources.resumeNativeSessionIdParameterName);
    if (!Object.isNull(instructions))
      ArgumentException.throwIfNullOrWhitespace(instructions, Resources.instructionsParameterName);
    if (!Object.isNull(freshPrompt))
      ArgumentException.throwIfNullOrWhitespace(freshPrompt, Resources.freshPromptParameterName);
    if (!Object.isNull(resumeAt))
      ArgumentException.throwIfNullOrWhitespace(resumeAt, Resources.resumeAtParameterName);
    if (!Object.isNull(command))
      ArgumentException.throwIfNullOrWhitespace(command, Resources.commandParameterName);

    this.provider = provider;
    this.workingDirectory = workingDirectory;
    this.prompt = prompt;
    this.requested = requested;
    this.resumeNativeSessionId = resumeNativeSessionId;
    this.attachments = [...attachments];
    this.instructions = instructions;
    this.instructionsWithoutTools = instructionsWithoutTools;
    this.freshPrompt = freshPrompt;
    this.environment = { ...environment };
    this.compacts = compacts;
    this.tools = tools;
    this.sharedServers = [...sharedServers];
    this.resumeAt = resumeAt;
    this.senderAdopter = adoptSender;
    this.sharedValues = sharedValues;
    this.isolated = isolated;
    this.command = command;
    this.compactsWhenIdle = compactsWhenIdle;
  }

  public adoptSender(token: string): boolean {
    return this.senderAdopter(token);
  }

  public withRequested(requested: RequestedSettings): TurnRequest {
    return new TurnRequest(this.provider, this.workingDirectory, this.prompt, requested, this.resumeNativeSessionId, this.attachments, this.instructions,
      this.freshPrompt, this.environment, this.compacts, this.tools, this.sharedServers, this.resumeAt, this.senderAdopter, this.sharedValues, this.instructionsWithoutTools,
      this.isolated, this.command, this.compactsWhenIdle);
  }

  public withoutImages(): TurnRequest {
    const images = this.attachments.filter(t => t.isImage).map(t => JSON.stringify(t.name));
    if (images.length === 0)
      return this;
    return new TurnRequest(this.provider, this.workingDirectory, Resources.formatImagesLeftOut(this.prompt, images), this.requested, this.resumeNativeSessionId,
      this.attachments.filter(t => !t.isImage), this.instructions, Object.isNull(this.freshPrompt) ? null : Resources.formatImagesLeftOut(this.freshPrompt, images),
      this.environment, this.compacts, this.tools, this.sharedServers, this.resumeAt, this.senderAdopter, this.sharedValues, this.instructionsWithoutTools,
      this.isolated, this.command, this.compactsWhenIdle);
  }
}
