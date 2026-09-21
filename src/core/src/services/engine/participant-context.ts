/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { DetailKind, type Message, MessageAuthor, MessagePageParams } from "@noldova/teamrun-protocol";

import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import { Resources } from "../../resources.js";
import { AttachmentStore } from "./attachment-store.js";

export class ParticipantContext {
  private readonly messages: IMessagesService;

  public constructor(messages: IMessagesService) {
    this.messages = messages;
  }

  public create(reply: Message, sent: Message, nativeSessionId: string | null, forked: boolean = false): string {
    const lines = new Map<number, string>();
    let remaining = Resources.joinPreambleMaximumCharacters;
    let before = reply.sequence;
    let omitted = false;
    let done = false;
    while (!done) {
      const page = this.messages.page(new MessagePageParams(reply.conversationId, before, null, Resources.contextPageSize));
      for (const message of [...page.messages].reverse()) {
        if (!Object.isNull(nativeSessionId) && ParticipantContext.isPreviousReply(message, reply, nativeSessionId, forked)) {
          done = true;
          break;
        }
        if (message.id === sent.id)
          continue;
        const text = ParticipantContext.textOf(message);
        if (text.length === 0)
          continue;
        const prefix = ParticipantContext.prefixOf(message);
        const available = Math.max(0, remaining - prefix.length - Resources.transcriptSeparator.length);
        if (available === 0) {
          omitted = true;
          done = true;
          break;
        }
        const tail = text.length > available ? text.slice(-available) : text;
        lines.set(message.sequence, prefix + tail);
        remaining -= prefix.length + tail.length + Resources.transcriptSeparator.length;
        if (text.length > available) {
          omitted = true;
          done = true;
          break;
        }
      }
      if (page.messages.length === 0 || !page.hasEarlier)
        done = true;
      else
        before = page.messages[0]!.sequence;
    }
    const text = ParticipantContext.textOf(sent);
    if (Object.isNull(reply.teammateId) && lines.size === 0)
      return text;
    const ordered = (): string => [...lines].sort((a, b) => a[0] - b[0]).map(t => t[1]).join(Resources.transcriptSeparator);
    const omission = omitted ? Resources.contextOmissionNote + Resources.transcriptSeparator : String.empty;
    if (Object.isNull(reply.teammateId) && Object.isNull(nativeSessionId))
      return Resources.formatTranscriptPreamble(omission + ordered(), text);
    lines.set(sent.sequence, Resources.transcriptUserPrefix + text);
    return Resources.formatParticipantContext(reply.teammateName, Object.isNull(nativeSessionId), omission + ordered());
  }

  private static textOf(message: Message): string {
    return AttachmentStore.formatPrompt(
      message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator).trim(), message.attachments);
  }

  private static prefixOf(message: Message): string {
    if (message.author === MessageAuthor.User)
      return Resources.transcriptUserPrefix;
    return Object.isNull(message.teammateName) ? Resources.transcriptAssistantPrefix : Resources.formatParticipantLabel(message.teammateName);
  }

  private static isPreviousReply(message: Message, reply: Message, sessionId: string, forked: boolean): boolean {
    return message.author === MessageAuthor.Provider && message.teammateId === reply.teammateId
      && message.provenance?.requested.provider === reply.provenance?.requested.provider
      && message.provenance?.providerAccountId === reply.provenance?.providerAccountId
      && !Object.isNullOrUndefined(message.provenance?.nativeSessionId)
      && (forked || message.provenance.nativeSessionId === sessionId);
  }
}
