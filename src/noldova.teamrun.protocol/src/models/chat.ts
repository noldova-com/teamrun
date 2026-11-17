/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { ChatResponder } from "./chat-responder.js";
import { ForkedSession } from "./forked-session.js";

export class Chat {
  public readonly id: string;
  public readonly projectId: string | null;
  public readonly title: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly sessionReset: boolean;
  public readonly forkedSession: ForkedSession | null;
  public readonly responder: ChatResponder | null;
  public readonly edited: boolean;
  public readonly folder: string | null;
  public readonly planFirst: boolean;
  public readonly approvedPlanTeammates: readonly string[];
  public readonly approvedResponderPlan: boolean;
  public readonly titleChosen: boolean;

  public constructor(
    id: string,
    projectId: string | null,
    title: string,
    createdAt: string,
    updatedAt: string,
    sessionReset: boolean = false,
    forkedSession: ForkedSession | null = null,
    responder: ChatResponder | null = null,
    edited: boolean = false,
    folder: string | null = null,
    planFirst: boolean = false,
    approvedPlanTeammates: readonly string[] = [],
    approvedResponderPlan: boolean = false,
    titleChosen: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    if (!Object.isNull(folder))
      ArgumentException.throwIfNullOrWhitespace(folder, Resources.folderField);
    for (const teammateId of approvedPlanTeammates)
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.approvedPlanTeammatesField);

    this.id = id;
    this.projectId = projectId;
    this.title = title;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.sessionReset = sessionReset;
    this.forkedSession = forkedSession;
    this.responder = responder;
    this.edited = edited;
    this.folder = folder;
    this.planFirst = planFirst;
    this.approvedPlanTeammates = [...approvedPlanTeammates];
    this.approvedResponderPlan = approvedResponderPlan;
    this.titleChosen = titleChosen;
  }

  public static fromJson(value: unknown, path?: string): Chat {
    const reader = JsonReader.fromValue(value, path);
    return new Chat(
      reader.readNonBlankString(Resources.idField),
      Object.isNull(reader.readNullableString(Resources.projectIdField)) ? null : reader.readNonBlankString(Resources.projectIdField),
      reader.readNonBlankString(Resources.titleField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.hasField(Resources.sessionResetField) ? reader.readBoolean(Resources.sessionResetField) : false,
      Chat.readForkedSession(reader),
      Chat.readResponder(reader),
      reader.hasField(Resources.editedField) ? reader.readBoolean(Resources.editedField) : false,
      reader.hasField(Resources.folderField) && !Object.isNull(reader.readNullableString(Resources.folderField))
        ? reader.readNonBlankString(Resources.folderField) : null,
      reader.hasField(Resources.planFirstField) && reader.readBoolean(Resources.planFirstField),
      reader.hasField(Resources.approvedPlanTeammatesField) ? reader.readStringArray(Resources.approvedPlanTeammatesField) : [],
      reader.hasField(Resources.approvedResponderPlanField) && reader.readBoolean(Resources.approvedResponderPlanField),
      reader.hasField(Resources.titleChosenField) && reader.readBoolean(Resources.titleChosenField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.sessionResetField]: this.sessionReset,
      [Resources.forkedSessionField]: Object.isNull(this.forkedSession) ? null : this.forkedSession.toJson(),
      [Resources.responderField]: Object.isNull(this.responder) ? null : this.responder.toJson(),
      [Resources.editedField]: this.edited,
      [Resources.folderField]: this.folder,
      ...this.planFirst ? { [Resources.planFirstField]: true } : {},
      ...this.approvedPlanTeammates.length > 0 ? { [Resources.approvedPlanTeammatesField]: [...this.approvedPlanTeammates] } : {},
      ...this.approvedResponderPlan ? { [Resources.approvedResponderPlanField]: true } : {},
      ...this.titleChosen ? { [Resources.titleChosenField]: true } : {}
    };
  }

  public withTitle(title: string, updatedAt: string): Chat {
    return new Chat(this.id, this.projectId, title, this.createdAt, updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withProjectId(projectId: string, updatedAt: string): Chat {
    return new Chat(this.id, projectId, this.title, this.createdAt, updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      null, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withFolder(folder: string | null): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withSessionReset(sessionReset: boolean, updatedAt: string): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, updatedAt, sessionReset, null, this.responder, this.edited,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withForkedSession(forkedSession: ForkedSession | null, updatedAt: string): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, updatedAt, false, forkedSession, this.responder, this.edited,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withResponder(responder: ChatResponder | null): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, responder, this.edited,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public asEdited(): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, this.responder, true,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, this.titleChosen);
  }

  public withChosenTitle(title: string, updatedAt: string): Chat {
    return new Chat(this.id, this.projectId, title, this.createdAt, updatedAt, this.sessionReset, this.forkedSession, this.responder, true,
      this.folder, this.planFirst, this.approvedPlanTeammates, this.approvedResponderPlan, true);
  }

  public plansFirst(teammateId: string | null): boolean {
    return this.planFirst && (Object.isNull(teammateId) ? !this.approvedResponderPlan : !this.approvedPlanTeammates.includes(teammateId));
  }

  public withPlanFirst(planFirst: boolean): Chat {
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      this.folder, planFirst, [], false, this.titleChosen);
  }

  public withPlanApproved(teammateId: string | null): Chat {
    if (!this.planFirst)
      return this;
    const teammates = Object.isNull(teammateId) || this.approvedPlanTeammates.includes(teammateId) ? this.approvedPlanTeammates
      : [...this.approvedPlanTeammates, teammateId];
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      this.folder, this.planFirst, teammates, this.approvedResponderPlan || Object.isNull(teammateId), this.titleChosen);
  }

  public withPlanReopened(teammateId: string | null): Chat {
    if (!this.planFirst)
      return this;
    return new Chat(this.id, this.projectId, this.title, this.createdAt, this.updatedAt, this.sessionReset, this.forkedSession, this.responder, this.edited,
      this.folder, this.planFirst, Object.isNull(teammateId) ? this.approvedPlanTeammates : this.approvedPlanTeammates.filter(t => t !== teammateId),
      this.approvedResponderPlan && !Object.isNull(teammateId), this.titleChosen);
  }

  private static readForkedSession(reader: JsonReader): ForkedSession | null {
    const fork = reader.hasField(Resources.forkedSessionField) ? reader.readNullableObject(Resources.forkedSessionField) : null;

    return Object.isNull(fork) ? null : ForkedSession.fromJson(fork.toJson(), fork.path);
  }

  private static readResponder(reader: JsonReader): ChatResponder | null {
    const responder = reader.hasField(Resources.responderField) ? reader.readNullableObject(Resources.responderField) : null;

    return Object.isNull(responder) ? null : ChatResponder.fromJson(responder.toJson(), responder.path);
  }
}
