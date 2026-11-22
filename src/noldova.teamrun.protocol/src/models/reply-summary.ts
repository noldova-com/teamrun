/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { DetailKind } from "../enums/detail-kind.js";
import { MessageStatus } from "../enums/message-status.js";
import { ReplyPanel } from "../enums/reply-panel.js";
import { Resources } from "../resources.js";
import { FileChangeReader } from "../services/file-change.reader.js";
import { TextCut } from "../services/text-cut.js";
import { FileChangeSummary } from "./file-change-summary.js";
import { Message } from "./message.js";
import { MessageDetail } from "./message-detail.js";
import { ReplyPlan } from "./reply-plan.js";

export class ReplySummary {
  private static readonly previewFields: readonly string[] = [Resources.toolField, Resources.toolUseIdField, Resources.isErrorField,
    Resources.sourceField, Resources.itemTypeField, Resources.statusField, Resources.deniedField, Resources.changesNoteField];

  public readonly preview: Message;
  public readonly files: readonly FileChangeSummary[];

  public constructor(preview: Message, files: readonly FileChangeSummary[]) {
    this.preview = preview;
    this.files = [...files];
  }

  public matches(panel: ReplyPanel): boolean {
    if (panel === ReplyPanel.Plan)
      return !Object.isNull(ReplyPlan.ofDetails(this.preview.details));
    if (panel === ReplyPanel.SubAgents)
      return this.preview.details.some(t => t.kind === DetailKind.SubAgent);
    if (panel === ReplyPanel.Changes)
      return this.files.length > 0 || this.preview.details.some(t => ReplySummary.isPayload(t.payload) && t.payload[Resources.changesNoteField] === true);
    return this.preview.details.some(t => {
      const payload = t.payload;
      if (this.preview.status === MessageStatus.Cancelled && t.kind === DetailKind.Note && Resources.cancelledReplyNotes.includes(t.text))
        return false;
      return t.kind !== DetailKind.Text && t.kind !== DetailKind.Error && t.kind !== DetailKind.Plan && !(ReplySummary.isPayload(payload)
        && (payload[Resources.itemTypeField] === Resources.imageGenerationItemType || payload[Resources.sourceField] === Resources.workingTreeSource
          || payload[Resources.sourceField] === Resources.handOffSource || payload[Resources.sourceField] === Resources.usageHandOffSource));
    });
  }

  public static fromMessage(message: Message): ReplySummary {
    const details = message.details.filter(t => t.kind !== DetailKind.Text && !t.isNested).map(detail => {
      if (detail.kind === DetailKind.Plan || detail.kind === DetailKind.SubAgent)
        return detail;
      const payload: Record<string, string | boolean> = {};
      if (ReplySummary.isPayload(detail.payload))
        for (const field of ReplySummary.previewFields) {
          const value = detail.payload[field];
          if (Object.isString(value) || Object.isBoolean(value))
            payload[field] = Object.isString(value) ? TextCut.toUnits(value, Resources.maximumPreviewTitleLength) : value;
        }
      const end = detail.text.indexOf(Resources.lineSeparator);
      const title = TextCut.toUnits(end < 0 ? detail.text : detail.text.slice(0, end), Resources.maximumPreviewTitleLength);
      return new MessageDetail(detail.sequence, detail.kind, title, payload, detail.createdAt);
    });
    return new ReplySummary(message.withDetails(details), new FileChangeReader().editsOf(message).map(t => FileChangeSummary.fromEdit(t)));
  }

  public static fromJson(value: unknown, path?: string): ReplySummary {
    const reader = JsonReader.fromValue(value, path);
    const preview = reader.readObject(Resources.previewField);
    return new ReplySummary(Message.fromJson(preview.toJson(), preview.path),
      reader.readObjectArray(Resources.filesField).map(t => FileChangeSummary.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return { [Resources.previewField]: this.preview.toJson(), [Resources.filesField]: this.files.map(t => t.toJson()) };
  }

  private static isPayload(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
