/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SubAgentStatus } from "../enums/sub-agent-status.js";
import { Resources } from "../resources.js";

export class SubAgent {
  public readonly toolUseId: string | null;
  public readonly type: string | null;
  public readonly description: string;
  public readonly model: string | null;
  public readonly status: SubAgentStatus;
  public readonly isBackground: boolean;
  public readonly toolUses: number | null;
  public readonly tokens: number | null;
  public readonly durationMs: number | null;
  public readonly summary: string | null;
  public readonly isTeamRun: boolean;

  public constructor(toolUseId: string | null, type: string | null, description: string, model: string | null, status: SubAgentStatus, isBackground: boolean,
    toolUses: number | null = null, tokens: number | null = null, durationMs: number | null = null, summary: string | null = null,
    isTeamRun: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);
    for (const [name, value] of [[Resources.toolUsesField, toolUses], [Resources.tokensField, tokens], [Resources.durationMsField, durationMs]] as const)
      if (!Object.isNull(value) && (!Number.isInteger(value) || value < 0))
        throw new ArgumentOutOfRangeException(name, value);

    this.toolUseId = String.isNullOrWhitespace(toolUseId) ? null : toolUseId;
    this.type = String.isNullOrWhitespace(type) ? null : type;
    this.description = description;
    this.model = String.isNullOrWhitespace(model) ? null : model;
    this.status = status;
    this.isBackground = isBackground;
    this.toolUses = toolUses;
    this.tokens = tokens;
    this.durationMs = durationMs;
    this.summary = String.isNullOrWhitespace(summary) ? null : summary;
    this.isTeamRun = isTeamRun;
  }

  public get isRunning(): boolean {
    return this.status === SubAgentStatus.Running;
  }

  public static fromJson(value: unknown, path?: string): SubAgent {
    const reader = JsonReader.fromValue(value, path);
    return new SubAgent(
      reader.readNullableString(Resources.toolUseIdField),
      reader.readNullableString(Resources.typeField),
      reader.readNonBlankString(Resources.descriptionField),
      reader.readNullableString(Resources.modelField),
      reader.readOneOf(Resources.statusField, Object.values(SubAgentStatus)),
      reader.readBoolean(Resources.isBackgroundField),
      reader.readNullableInteger(Resources.toolUsesField),
      reader.readNullableInteger(Resources.tokensField),
      reader.readNullableInteger(Resources.durationMsField),
      reader.readNullableString(Resources.summaryField),
      reader.hasField(Resources.isTeamRunField) && reader.readBoolean(Resources.isTeamRunField));
  }

  public with(changes: Partial<Pick<SubAgent, "model" | "status" | "isBackground" | "toolUses" | "tokens" | "durationMs" | "summary">>): SubAgent {
    return new SubAgent(this.toolUseId, this.type, this.description, changes.model ?? this.model, changes.status ?? this.status, changes.isBackground ?? this.isBackground,
      changes.toolUses ?? this.toolUses, changes.tokens ?? this.tokens, changes.durationMs ?? this.durationMs, changes.summary ?? this.summary,
      this.isTeamRun);
  }

  public toJson(): JsonObject {
    return {
      [Resources.toolUseIdField]: this.toolUseId,
      [Resources.typeField]: this.type,
      [Resources.descriptionField]: this.description,
      [Resources.modelField]: this.model,
      [Resources.statusField]: this.status,
      [Resources.isBackgroundField]: this.isBackground,
      [Resources.toolUsesField]: this.toolUses,
      [Resources.tokensField]: this.tokens,
      [Resources.durationMsField]: this.durationMs,
      [Resources.summaryField]: this.summary,
      ...(this.isTeamRun ? { [Resources.isTeamRunField]: true } : {})
    };
  }
}
