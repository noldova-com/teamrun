/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class ThreadStartResult {
  public readonly threadId: string;
  public readonly model: string;
  public readonly reasoningEffort: string | null;
  public readonly serviceTier: string | null | undefined;
  public readonly collaborationMode: string | null;

  public constructor(threadId: string, model: string, reasoningEffort: string | null, serviceTier?: string | null, collaborationMode: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(threadId, Resources.threadIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(model, Resources.modelParameterName);

    this.threadId = threadId;
    this.model = model;
    this.reasoningEffort = reasoningEffort;
    this.serviceTier = serviceTier;
    this.collaborationMode = collaborationMode;
  }

  public static fromJson(value: unknown, path?: string): ThreadStartResult {
    const reader = JsonReader.fromValue(value, path);
    const threadId = reader.readObject(Resources.threadField).readNonBlankString(Resources.idField);
    const reasoningEffort = reader.hasField(Resources.reasoningEffortField) ? reader.readNullableString(Resources.reasoningEffortField) : null;

    const serviceTier = reader.hasField(Resources.codexServiceTierField) ? reader.readNullableString(Resources.codexServiceTierField) : undefined;

    const collaboration = reader.hasField(Resources.codexCollaborationModeField) ? reader.readNullableObject(Resources.codexCollaborationModeField) : null;
    return new ThreadStartResult(threadId, reader.readNonBlankString(Resources.modelField), reasoningEffort, serviceTier,
      collaboration?.readOptionalString(Resources.codexModeField) ?? null);
  }
}
