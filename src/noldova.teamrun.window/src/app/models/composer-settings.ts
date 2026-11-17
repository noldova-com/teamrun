/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { ConversationResponder, type DefaultTeammate, RequestedSettings } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class ComposerSettings {
  public readonly kind: string;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly providerId: string | null;
  public readonly responderTeammateId: string | null;
  public readonly speed: string | null;
  public readonly mode: string | null;

  public constructor(kind: string, model: string | null, effort: string | null, providerId: string | null, responderTeammateId: string | null = null,
    speed: string | null = null, mode: string | null = null) {
    this.kind = kind;
    this.model = model;
    this.effort = effort;
    this.providerId = providerId;
    this.responderTeammateId = responderTeammateId;
    this.speed = speed;
    this.mode = mode;
  }

  public static fromJson(value: unknown): ComposerSettings | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = { ...value };
    const kind = ComposerSettings.readOptional(record[Resources.kindField]);
    if (Object.isNull(kind))
      return null;
    return new ComposerSettings(kind, ComposerSettings.readOptional(record[Resources.modelField]), ComposerSettings.readOptional(record[Resources.effortField]),
      ComposerSettings.readOptional(record[Resources.providerIdField]), ComposerSettings.readOptional(record[Resources.responderTeammateIdField]),
      ComposerSettings.readOptional(record[Resources.speedField]), ComposerSettings.readOptional(record[Resources.modeField]));
  }

  public static fromResponder(responder: ConversationResponder): ComposerSettings | null {
    const requested = responder.requested;
    return Object.isNull(requested) ? null
      : new ComposerSettings(requested.kind, requested.model, requested.effort, responder.providerId, null, requested.speed, requested.mode);
  }

  public static startingWith(defaultTeammate: DefaultTeammate | null, lastSent: ComposerSettings | null): ComposerSettings | null {
    return Object.isNull(defaultTeammate) ? lastSent?.withMode(null) ?? null : new ComposerSettings(defaultTeammate.requested.kind, defaultTeammate.requested.model,
      defaultTeammate.requested.effort, defaultTeammate.providerId, null, defaultTeammate.requested.speed, defaultTeammate.requested.mode);
  }

  private static readOptional(value: unknown): string | null {
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.providerIdField]: this.providerId,
      [Resources.responderTeammateIdField]: this.responderTeammateId,
      [Resources.speedField]: this.speed,
      [Resources.modeField]: this.mode
    };
  }

  public toRequested(): RequestedSettings {
    return new RequestedSettings(this.kind, this.model, this.effort, this.speed, this.mode);
  }

  public toResponder(): ConversationResponder {
    return Object.isNull(this.responderTeammateId) ? new ConversationResponder(null, this.toRequested(), this.providerId)
      : new ConversationResponder(this.responderTeammateId);
  }

  public following(responder: ConversationResponder): ComposerSettings {
    return ComposerSettings.fromResponder(responder) ?? this.withResponder(responder.teammateId);
  }

  public withResponder(responderTeammateId: string | null): ComposerSettings {
    return new ComposerSettings(this.kind, this.model, this.effort, this.providerId, responderTeammateId, this.speed, this.mode);
  }

  public withProvider(providerId: string | null): ComposerSettings {
    return new ComposerSettings(this.kind, this.model, this.effort, providerId, this.responderTeammateId, this.speed, this.mode);
  }

  public withMode(mode: string | null): ComposerSettings {
    return new ComposerSettings(this.kind, this.model, this.effort, this.providerId, this.responderTeammateId, this.speed, mode);
  }

  public equals(other: ComposerSettings | null): boolean {
    return !Object.isNull(other) && this.kind === other.kind && this.model === other.model && this.effort === other.effort
      && this.providerId === other.providerId && this.responderTeammateId === other.responderTeammateId && this.speed === other.speed
      && this.mode === other.mode;
  }
}
