/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { ForkedSession } from "./forked-session.js";

export class Conversation {
  public readonly id: string;
  public readonly projectId: string;
  public readonly title: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly sessionReset: boolean;
  public readonly forkedSession: ForkedSession | null;

  public constructor(
    id: string,
    projectId: string,
    title: string,
    createdAt: string,
    updatedAt: string,
    sessionReset: boolean = false,
    forkedSession: ForkedSession | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);

    this.id = id;
    this.projectId = projectId;
    this.title = title;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.sessionReset = sessionReset;
    this.forkedSession = forkedSession;
  }

  public static fromJson(value: unknown, path?: string): Conversation {
    const reader = JsonReader.fromValue(value, path);
    return new Conversation(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.projectIdField),
      reader.readNonBlankString(Resources.titleField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.hasField(Resources.sessionResetField) ? reader.readBoolean(Resources.sessionResetField) : false,
      Conversation.readForkedSession(reader));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.sessionResetField]: this.sessionReset,
      [Resources.forkedSessionField]: Object.isNull(this.forkedSession) ? null : this.forkedSession.toJson()
    };
  }

  public withTitle(title: string, updatedAt: string): Conversation {
    return new Conversation(this.id, this.projectId, title, this.createdAt, updatedAt, this.sessionReset, this.forkedSession);
  }

  public withProjectId(projectId: string, updatedAt: string): Conversation {
    return new Conversation(this.id, projectId, this.title, this.createdAt, updatedAt, this.sessionReset, this.forkedSession);
  }

  public withSessionReset(sessionReset: boolean, updatedAt: string): Conversation {
    return new Conversation(this.id, this.projectId, this.title, this.createdAt, updatedAt, sessionReset, null);
  }

  public withForkedSession(forkedSession: ForkedSession | null, updatedAt: string): Conversation {
    return new Conversation(this.id, this.projectId, this.title, this.createdAt, updatedAt, false, forkedSession);
  }

  private static readForkedSession(reader: JsonReader): ForkedSession | null {
    const fork = reader.hasField(Resources.forkedSessionField) ? reader.readNullableObject(Resources.forkedSessionField) : null;

    return Object.isNull(fork) ? null : ForkedSession.fromJson(fork.toJson(), fork.path);
  }
}
