/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  type ConversationIdParams, Draft, type DraftDiscardParams, type DraftSaveParams, ErrorCode, type MessageAttachment
} from "@noldova/teamrun.protocol";

import type { IDraftsService } from "../../interfaces/i-drafts.service.js";
import type { ILog } from "../../interfaces/i-log.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { AttachmentStore } from "../engine/attachment-store.js";

export class DraftsService implements IDraftsService {
  private readonly context: DatabaseContext;
  private readonly attachments: AttachmentStore;
  private readonly log: ILog;

  public constructor(context: DatabaseContext, attachments: AttachmentStore, log: ILog) {
    this.context = context;
    this.attachments = attachments;
    this.log = log;
  }

  public async saveAsync(params: DraftSaveParams): Promise<Draft> {
    let restore: readonly MessageAttachment[] | null = null;
    let draft: Draft;
    try {
      draft = await this.context.database.connection.runInTransactionAsync(async transaction => {
        await this.requireConversationAsync(params.conversationId, transaction);
        const current = await this.findAsync(params.conversationId, transaction);
        const revision = await this.revisionOfAsync(params.conversationId, transaction) + 1;
        const files = this.attachments.saveDraft(params.conversationId, params.attachments);
        restore = current?.attachments ?? [];
        const saved = new Draft(params.conversationId, params.text, files, [], revision, new Date().toISOString());
        await transaction.executeAsync(new SqlQuery(Resources.upsertDraft,
          [saved.conversationId, JSON.stringify(saved.toJson()), saved.revision, saved.updatedAt]));
        return saved;
      });
    }
    catch (error) {
      if (!Object.isNull(restore))
        this.removeFilesExcept(params.conversationId, restore);
      throw error;
    }
    this.removeFilesExcept(params.conversationId, draft.attachments);
    return draft;
  }

  public async readAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Draft | null> {
    await this.requireConversationAsync(params.conversationId, transaction);
    const draft = await this.findAsync(params.conversationId, transaction);
    if (Object.isNull(draft))
      return null;

    const present = draft.attachments.filter(t => this.attachments.exists(t));
    const missing = draft.attachments.filter(t => !present.includes(t)).map(t => t.name);
    return new Draft(draft.conversationId, draft.text, present, missing, draft.revision, draft.updatedAt);
  }

  public async discardAsync(params: DraftDiscardParams): Promise<void> {
    const discarded = await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireConversationAsync(params.conversationId, transaction);
      const draft = await this.findAsync(params.conversationId, transaction);
      if (Object.isNull(draft) || (!Object.isNull(params.revision) && params.revision !== draft.revision))
        return false;
      await transaction.executeAsync(new SqlQuery(Resources.discardDraft, [new Date().toISOString(), params.conversationId]));
      return true;
    });
    if (discarded)
      this.removeFiles(params.conversationId);
  }

  public async forgetAsync(conversationId: string, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.deleteDraft, [conversationId]));
  }

  public removeFiles(conversationId: string): void {
    this.removeFilesExcept(conversationId, []);
  }

  public removeChatFiles(conversationId: string): void {
    this.removeFiles(conversationId);
    try {
      this.attachments.removeWaitingFiles(conversationId);
    }
    catch (error) {
      this.log.write(Resources.formatChatWaitingFilesNotRemoved(conversationId, DraftsService.reasonOf(error)));
    }
  }

  public async sweepAsync(): Promise<void> {
    for (const conversationId of this.attachments.listDraftFolders())
      await this.context.database.connection.runInTransactionAsync(async transaction => {
        const held = await this.heldFilesAsync(conversationId, transaction);
        if (!Object.isNull(held))
          this.removeFilesExcept(conversationId, held);
      });
  }

  private removeFilesExcept(conversationId: string, keep: readonly MessageAttachment[]): boolean {
    try {
      this.attachments.removeDraftFiles(conversationId, keep);
      return true;
    }
    catch (error) {
      this.log.write(Resources.formatDraftFilesNotRemoved(conversationId, DraftsService.reasonOf(error)));
      return false;
    }
  }

  private async heldFilesAsync(conversationId: string, transaction: SqlTransaction): Promise<readonly MessageAttachment[] | null> {
    try {
      return (await this.findAsync(conversationId, transaction))?.attachments ?? [];
    }
    catch (error) {
      this.log.write(Resources.formatDraftNotRead(conversationId, DraftsService.reasonOf(error)));
      return null;
    }
  }

  private async findAsync(conversationId: string, transaction?: SqlTransaction): Promise<Draft | null> {
    const json = (await this.selectAsync(conversationId, transaction))?.readNullableString(Resources.jsonColumn) ?? null;
    return Object.isNull(json) ? null : Draft.fromJson(JsonReader.parse(json).toJson());
  }

  private async revisionOfAsync(conversationId: string, transaction: SqlTransaction): Promise<number> {
    return (await this.selectAsync(conversationId, transaction))?.readInteger(Resources.revisionColumn) ?? 0;
  }

  private async selectAsync(conversationId: string, transaction?: SqlTransaction): Promise<DataRecord | undefined> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectDraft, [conversationId]));
    return record;
  }

  private async requireConversationAsync(conversationId: string, transaction?: SqlTransaction): Promise<void> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectConversationById, [conversationId]));
    if (Object.isUndefined(record))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(conversationId), [conversationId]);
  }

  private static reasonOf(error: unknown): string {
    return error instanceof Error ? (error as NodeJS.ErrnoException).code ?? error.name : typeof error;
  }
}
