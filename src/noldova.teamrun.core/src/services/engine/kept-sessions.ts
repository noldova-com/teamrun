/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { type Conversation, ConversationMemberParams, type ConversationRewindParams, ConversationRewindResult, ConversationRewoundPayload, ErrorCode, Event, EventName,
  ForkedSession, type Message, MessageAuthor } from "@noldova/teamrun.protocol";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import { CheckpointRestore } from "../../models/checkpoint-restore.js";
import { ForkRequest } from "../../models/fork-request.js";
import { WorkFolder } from "../../models/work-folder.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";
import type { AttachmentStore } from "./attachment-store.js";
import type { EngineServices } from "./engine-services.js";
import type { ReplyCheckpoints } from "./reply-checkpoints.js";
import { ReplyRun } from "./reply-run.js";

export class KeptSessions {
  private readonly context: DatabaseContext;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly providers: IProvidersService;
  private readonly registry: ProviderKindRegistry;
  private readonly events: IEventSink;
  private readonly log: ILog | null;
  private readonly checkpoints: ReplyCheckpoints | null;
  private readonly attachments: AttachmentStore;
  private readonly nativeSessions: Map<string, Map<string, Set<string>>> = new Map();
  private readonly forgotten: Set<string> = new Set();
  private readonly requireConversationAsync: IEngineCallbacks["requireConversationAsync"];
  private readonly requireMessageAsync: IEngineCallbacks["requireMessageAsync"];
  private readonly requireWorkFolderAsync: IEngineCallbacks["requireWorkFolderAsync"];

  public constructor(services: EngineServices, callbacks: IEngineCallbacks) {
    this.context = services.context;
    this.conversations = services.conversations;
    this.messages = services.messages;
    this.providers = services.providers;
    this.registry = services.registry;
    this.events = services.events;
    this.log = services.log;
    this.checkpoints = services.checkpoints;
    this.attachments = services.attachments;
    this.requireConversationAsync = callbacks.requireConversationAsync;
    this.requireMessageAsync = callbacks.requireMessageAsync;
    this.requireWorkFolderAsync = callbacks.requireWorkFolderAsync;
  }

  public async rewindAsync(params: ConversationRewindParams): Promise<ConversationRewindResult> {
    const conversation = await this.requireConversationAsync(params.conversationId);
    const folder = await this.requireWorkFolderAsync(conversation, true);
    if (!Object.isNull(await this.messages.findOpenReplyAsync(conversation.id)))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id), [conversation.id]);
    const target = await this.messages.findAsync(params.messageId);
    if (Object.isNull(target))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotFound(params.messageId), [params.messageId]);
    if (target.conversationId !== conversation.id)
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotInConversation(target.id, conversation.id), [target.id, conversation.id]);

    const projectLease = this.context.projectActivity.enter(folder.path);
    try {
      const going = await this.messages.listOutlinesAsync(conversation.id, target.sequence === 0 ? null : target.sequence - 1);
      const firstReply = going.find(t => t.author === MessageAuthor.Provider);
      const restored = params.restoreFiles && !Object.isUndefined(firstReply) ? await this.restoreAsync(folder, firstReply, going) : null;
      const history = await this.messages.listOutlinesAsync(conversation.id, null);
      const kept = history.filter(t => t.sequence < target.sequence && t.author === MessageAuthor.Provider && Object.isNull(t.teammateId));
      const forked = await this.tryForkAsync(folder.path, kept[kept.length - 1],
        going.filter(t => t.author === MessageAuthor.Provider && Object.isNull(t.teammateId)));
      const [removed, marked] = await this.context.database.connection.runInTransactionAsync(async (transaction)
        : Promise<readonly [readonly Message[], Conversation]> => {
        for (const teammateId of new Set(going.map(t => t.teammateId).filter((id): id is string => !Object.isNull(id)))) {
          const member = new ConversationMemberParams(conversation.id, teammateId);
          if (!Object.isNull(await this.conversations.findMemberAsync(member, transaction)))
            await this.conversations.setMemberSessionAsync(member, null, false, undefined, transaction);
        }
        const gone = await this.conversations.removeFromAsync(conversation.id, target.sequence, transaction);
        return [gone, Object.isNull(forked)
          ? await this.conversations.setSessionResetAsync(conversation.id, true, transaction)
          : await this.conversations.setForkedSessionAsync(conversation.id, forked, transaction)];
      }).catch((error: unknown) => {
        throw Object.isNullOrUndefined(restored?.files) ? error
          : new ServiceException(ErrorCode.Internal, Resources.rewindNotSavedAfterRestore, [], { cause: error });
      });
      this.removeSentFiles(conversation.id, removed.filter(t => t.id !== target.id || t.author !== MessageAuthor.User));
      this.events.publish(new Event(EventName.ConversationRewound, new ConversationRewoundPayload(conversation.id, target.sequence).toJson()));
      this.events.publish(new Event(EventName.StateInvalidated, null));

      return new ConversationRewindResult(marked, removed.map(t => t.id), restored?.files ?? null, !Object.isNull(forked), restored?.refusal ?? null);
    }
    finally {
      this.context.projectActivity.leave(projectLease);
    }
  }

  public async releaseFolderAsync(conversationId: string, signal?: AbortSignal): Promise<void> {
    const folders = this.context.chatFolders;
    try {
      const conversation = await this.conversations.findAsync(conversationId);
      if (!folders.exists(conversationId) || (!Object.isNull(conversation) && Object.isNull(conversation.projectId)))
        return;
      if (!Object.isNull(this.checkpoints) && !await this.checkpoints.deleteAsync(new WorkFolder(conversationId, folders.pathOf(conversationId)), signal)) {
        this.log?.write(Resources.formatChatFolderKept(conversationId, Resources.checkpointsHeldUp));
        return;
      }
      folders.remove(conversationId);
    }
    catch (error) {
      this.log?.write(Resources.formatChatFolderKept(conversationId, Resources.formatFailureKind(error)));
    }
  }

  public async sweepFoldersAsync(signal: AbortSignal): Promise<void> {
    let conversationIds: readonly string[];
    try {
      conversationIds = this.context.chatFolders.list();
    }
    catch (error) {
      this.log?.write(Resources.formatChatFoldersNotSwept(Resources.formatFailureKind(error)));
      return;
    }
    for (const conversationId of conversationIds) {
      if (signal.aborted)
        return;
      await this.releaseFolderAsync(conversationId, signal);
    }
  }

  public forget(conversationId: string): void {
    for (const [kind, sessionIds] of this.nativeSessions.get(conversationId) ?? [])
      this.closeSessions(kind, [...sessionIds]);
    this.nativeSessions.delete(conversationId);
    this.forgotten.add(conversationId);
  }

  public noteSession(conversationId: string, kind: string, nativeSessionId: string | null | undefined): void {
    if (Object.isNullOrUndefined(nativeSessionId))
      return;
    if (this.forgotten.has(conversationId)) {
      this.closeSessions(kind, [nativeSessionId]);
      return;
    }
    const kinds = this.nativeSessions.get(conversationId) ?? new Map<string, Set<string>>();
    kinds.set(kind, (kinds.get(kind) ?? new Set<string>()).add(nativeSessionId));
    this.nativeSessions.set(conversationId, kinds);
  }

  private closeSessions(kind: string, nativeSessionIds: readonly string[]): void {
    if (!this.registry.has(kind))
      return;
    const adapter = this.registry.get(kind);
    void Promise.resolve().then(() => adapter.closeSessions?.(nativeSessionIds)).catch((error: unknown) => {
      this.log?.write(Resources.formatKeptSessionsNotClosed(kind, Resources.formatFailureKind(error)));
    });
  }

  private async restoreAsync(folder: WorkFolder, reply: Message, going: readonly Message[]): Promise<CheckpointRestore> {
    if (!KeptSessions.ranIn(folder, await this.messages.findCheckpointFolderAsync(reply.id)))
      return CheckpointRestore.refused(Resources.checkpointFolderChangedRefusal);
    const checkpoint = await this.messages.findCheckpointAsync(reply.id);
    if (Object.isNull(checkpoint) || Object.isNull(this.checkpoints))
      return CheckpointRestore.refused(Resources.noCheckpointRefusal);
    const replies: Message[] = [];
    let isPartial = false;
    for (const t of going.filter(u => u.author === MessageAuthor.Provider)) {
      const message = await this.requireMessageAsync(t.id);
      if (Object.isNull(message.startedAt) || !KeptSessions.ranIn(folder, await this.messages.findCheckpointFolderAsync(t.id)))
        continue;
      if (Object.isNull(await this.messages.findCheckpointAsync(t.id)) || ReplyRun.hasPartialEvidence(message.details))
        isPartial = true;
      replies.push(message);
    }
    return await this.checkpoints.restoreAsync(folder, checkpoint, isPartial ? null : replies.flatMap(t => ReplyRun.reportedFiles(t.details)));
  }

  private static ranIn(folder: WorkFolder, folderId: string | null): boolean {
    return Object.isNull(folderId) || folderId === folder.id;
  }

  private async tryForkAsync(workingDirectory: string, kept: Message | undefined, removed: readonly Message[]): Promise<ForkedSession | null> {
    const provenance = kept?.provenance;
    if (Object.isNullOrUndefined(provenance) || Object.isNull(provenance.nativeSessionId) || Object.isNull(provenance.nativeTurnId))
      return null;
    if (!this.registry.has(provenance.requested.kind) || !this.registry.get(provenance.requested.kind).descriptor.supportsFork)
      return null;
    if (removed.some(t => t.provenance?.nativeSessionId !== provenance.nativeSessionId))
      return null;
    const provider = Object.isNull(provenance.providerId) ? null : await this.providers.findAsync(provenance.providerId);
    if (!Object.isNull(provenance.providerId) && Object.isNull(provider))
      return null;
    try {
      const request = new ForkRequest(provider, workingDirectory, provenance.nativeSessionId, provenance.nativeTurnId, provenance.requested);
      const forked = await this.registry.get(provenance.requested.kind).forkSession(request);
      return new ForkedSession(provenance.requested.kind, provenance.providerId, forked.nativeSessionId, forked.resumeAt);
    }
    catch {
      return null;
    }
  }

  private removeSentFiles(conversationId: string, removed: readonly Message[]): void {
    try {
      this.attachments.removeSent(removed.flatMap(t => t.attachments.map(u => u.path)));
    }
    catch (error) {
      this.log?.write(Resources.formatSentFilesNotRemoved(conversationId, Resources.formatFailureReason(error)));
    }
  }
}
