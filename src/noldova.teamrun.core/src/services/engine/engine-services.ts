/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { ITurnToolSessions } from "../../interfaces/i-turn-tool-sessions.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";
import type { AttachmentStore } from "./attachment-store.js";
import type { ReplyCheckpoints } from "./reply-checkpoints.js";

export class EngineServices {
  public readonly context: DatabaseContext;
  public readonly projects: IProjectsService;
  public readonly conversations: IConversationsService;
  public readonly messages: IMessagesService;
  public readonly approvals: IApprovalsService;
  public readonly providers: IProvidersService;
  public readonly teammates: ITeammatesService;
  public readonly registry: ProviderKindRegistry;
  public readonly events: IEventSink;
  public readonly tools: ITurnToolSessions | null;
  public readonly log: ILog | null;
  public readonly checkpoints: ReplyCheckpoints | null;
  public readonly attachments: AttachmentStore;

  public constructor(context: DatabaseContext, projects: IProjectsService, conversations: IConversationsService, messages: IMessagesService, approvals: IApprovalsService,
    providers: IProvidersService, teammates: ITeammatesService, registry: ProviderKindRegistry, events: IEventSink, tools: ITurnToolSessions | null,
    log: ILog | null, checkpoints: ReplyCheckpoints | null, attachments: AttachmentStore) {
    this.context = context;
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
    this.approvals = approvals;
    this.providers = providers;
    this.teammates = teammates;
    this.registry = registry;
    this.events = events;
    this.tools = tools;
    this.log = log;
    this.checkpoints = checkpoints;
    this.attachments = attachments;
  }
}
