/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { DetailKind, MentionResolver, type MentionToken, type Message, MessageAuthor, type MessageDetail, MessageListParams, MessagePageParams, ReplyPlan, type Teammate, TeammateMention } from "@noldova/teamrun.protocol";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Resources } from "../../resources.js";
import type { ChatSummary } from "../sustain/chat-summary.js";
import { Handover } from "../sustain/handover.js";
import { HandoverPrompt } from "../sustain/handover-prompt.js";
import { HandoverSummary } from "../sustain/handover-summary.js";
import { HandoverTurn } from "../sustain/handover-turn.js";
import { AttachmentStore } from "./attachment-store.js";

export class ParticipantContext {
  private readonly messages: IMessagesService;
  private readonly teammates: ITeammatesService;
  private readonly conversations: IConversationsService;

  public constructor(messages: IMessagesService, teammates: ITeammatesService, conversations: IConversationsService) {
    this.messages = messages;
    this.teammates = teammates;
    this.conversations = conversations;
  }

  public async createAsync(reply: Message, sent: Message, nativeSessionId: string | null, forked: boolean = false, handOffs: readonly Message[] = []): Promise<string> {
    const teammates = await this.teammatesAsync();
    const titles = await this.titlesAsync([sent, ...handOffs]);
    const lines = new Map<number, string>();
    const recipients = new Map<string, (string | null)[]>();
    const answered = new Set<string>();
    const steered = new Map<string, number[]>();
    let remaining = Resources.joinPreambleMaximumCharacters;
    let before = reply.sequence;
    let omitted = false;
    let done = false;
    while (!done) {
      const page = await this.messages.pageAsync(new MessagePageParams(reply.conversationId, before, null, Resources.contextPageSize));
      await this.addTitlesAsync(titles, page.messages);
      for (const message of [...page.messages].reverse()) {
        if (!Object.isNull(nativeSessionId) && ParticipantContext.isPreviousReply(message, reply, nativeSessionId, forked)) {
          for (const sequence of steered.get(message.id) ?? [])
            lines.delete(sequence);
          done = true;
          break;
        }
        const into = ParticipantContext.steeredIntoOf(message);
        if (!Object.isNull(into))
          steered.set(into, [...steered.get(into) ?? [], message.sequence]);
        if (message.author === MessageAuthor.Provider && !Object.isNull(message.inReplyTo)) {
          if (message.teammateId === reply.teammateId)
            answered.add(message.inReplyTo);
          else
            ParticipantContext.addRecipient(recipients, message.inReplyTo, message.teammateName);
        }
        if (message.id === sent.id)
          continue;
        const text = this.textOf(message, teammates);
        if (text.length === 0)
          continue;
        const prefix = this.prefixOf(message, titles, recipients.get(message.id), answered.has(message.id));
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
    const text = this.askedTextOf(sent, reply, teammates);
    const asked = Object.isNull(sent.sender) ? text : this.prefixOf(sent, titles, [], false, true) + text;
    if (Object.isNull(reply.teammateId) && lines.size === 0)
      return asked;
    const ordered = (): string => [...lines].sort((a, b) => a[0] - b[0]).map(t => t[1]).join(Resources.transcriptSeparator);
    const omission = omitted ? Resources.contextOmissionNote + Resources.transcriptSeparator : String.empty;
    if (Object.isNull(reply.teammateId) && Object.isNull(nativeSessionId))
      return Resources.formatTranscriptPreamble(omission + ordered(), asked, Object.isNull(sent.sender));
    lines.set(sent.sequence, this.prefixOf(sent, titles, [], false, true) + text);
    const closes = this.closesOf(reply, sent, handOffs, lines, teammates);
    const transcript = omission + ordered();
    const opening = transcript.length === 0 ? [] : [Resources.formatParticipantContext(reply.teammateName, Object.isNull(nativeSessionId), transcript)];
    return [...opening, ...closes].join(Resources.transcriptSeparator);
  }

  public async createHandoverAsync(reply: Message, sent: Message, continued: Message | null, handOffs: readonly Message[], windowTokens: number | null,
    instructions: string | null, summary: ChatSummary | null = null): Promise<HandoverPrompt | null> {
    const chat = await this.chatBeforeAsync(reply, continued);
    const teammates = await this.teammatesAsync();
    const titles = await this.titlesAsync([...chat, sent]);
    const all = this.turnsOf(reply, sent, chat, teammates, titles);
    const text = this.askedTextOf(sent, reply, teammates);
    const asked = this.prefixOf(sent, titles, [], false, true) + text;
    const lines = new Map<number, string>([...all.map((t): [number, string] => [t.sequence, t.text]), [sent.sequence, asked]]);
    const closes = this.closesOf(reply, sent, handOffs, lines, teammates);
    const turns = all.filter(t => lines.has(t.sequence));
    const written = Object.isNull(continued) ? [] : [Resources.formatSustainContinued(this.handoverTextOf(continued, false, teammates))];
    const opening = Resources.formatParticipantContext(reply.teammateName, true, lines.has(sent.sequence) ? Resources.transcriptSeparator + asked : String.empty);
    const after = [...closes, ...written].map(t => Resources.transcriptSeparator + t);
    const budget = Handover.budgetOf(windowTokens, [instructions, opening, ...after].filter(t => Object.isString(t)), sent.attachments);
    const compacted = Object.isNull(summary) ? null : ParticipantContext.summaryOf([...chat, continued ?? reply], reply.teammateId, summary);
    const history = Handover.choose(reply.conversationId, turns, budget, compacted);
    if (Object.isNull(history))
      return null;
    const transcript = [...history.text.length === 0 ? [] : [history.text], ...lines.has(sent.sequence) ? [asked] : []].join(Resources.transcriptSeparator);
    const first = chat.find(t => t.sequence === turns[0]?.sequence);
    const answer = Resources.formatHandoverCarriedAnswer(lines.has(sent.sequence), !Object.isNull(continued));
    return new HandoverPrompt([Resources.formatParticipantContext(reply.teammateName, true, transcript), ...closes, ...written].join(Resources.transcriptSeparator),
      [...Handover.carriedOf(turns, history.kept, Object.isUndefined(first) ? null : ParticipantContext.authorOf(first), compacted, history.covered),
        ...Object.isNull(answer) ? [] : [answer]],
      history.kept.size + history.covered.size < turns.length);
  }

  public async createSummaryPromptAsync(reply: Message, sent: Message, continued: Message | null, windowTokens: number | null)
    : Promise<readonly [number, string] | null> {
    const chat = await this.chatBeforeAsync(reply, continued);
    const point = ParticipantContext.pointOf([...chat, continued ?? reply], reply.teammateId);
    if (Object.isUndefined(point))
      return null;
    const earlier = chat.filter(t => t.sequence < point.sequence);
    const turns = this.turnsOf(reply, sent, earlier, await this.teammatesAsync(), await this.titlesAsync(earlier));
    const budget = Handover.budgetOf(windowTokens, [Resources.formatOwnSummaryPrompt(String.empty)], [], Number.MAX_SAFE_INTEGER);
    const history = Handover.choose(reply.conversationId, turns, budget);
    return Object.isNull(history) ? null : [point.sequence - 1, Resources.formatOwnSummaryPrompt(history.text)];
  }

  public async compactedAsync(reply: Message, continued: Message | null): Promise<boolean> {
    return !Object.isUndefined(ParticipantContext.pointOf([...await this.chatBeforeAsync(reply, continued), continued ?? reply], reply.teammateId));
  }

  public static asksToCompact(message: Message): boolean {
    return message.attachments.length === 0 && ParticipantContext.commandOf(message) === Resources.compactCommand;
  }

  public static commandOf(message: Message): string | null {
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator);
    let rest = String.empty;
    let last = 0;
    for (const span of MentionResolver.find(text, message.mentions)) {
      rest += text.slice(last, span.start);
      last = span.end;
    }
    const command = (rest + text.slice(last)).trim();
    return Resources.slashCommandPattern.test(command) ? command : null;
  }

  private static authorOf(message: Message): string | null {
    return message.author === MessageAuthor.User ? message.sender?.name ?? null : message.teammateName;
  }

  private static hasTools(message: Message): boolean {
    return message.details.some(t => !t.isNested && (t.kind === DetailKind.Command || t.kind === DetailKind.FileChange || t.kind === DetailKind.SubAgent));
  }

  private closesOf(reply: Message, sent: Message, handOffs: readonly Message[], lines: Map<number, string>, teammates: ReadonlyMap<string, Teammate>): string[] {
    const teammateId = reply.teammateId;
    return Object.isNull(teammateId) ? [] : [sent, ...handOffs].flatMap(t => t.author === MessageAuthor.Provider && !Object.isNull(t.teammateName)
      ? [this.closeOf(t, t.teammateName, teammateId, lines, teammates)] : []);
  }

  private closeOf(handOff: Message, name: string, teammateId: string, lines: Map<number, string>, teammates: ReadonlyMap<string, Teammate>): string {
    const addressed = this.addressedTo(handOff, teammateId, teammates);
    if (addressed === this.textOf(handOff, teammates))
      lines.delete(handOff.sequence);
    return Resources.formatHandOff(name, addressed);
  }

  private addressedTo(message: Message, teammateId: string, teammates: ReadonlyMap<string, Teammate>): string {
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator);
    const available = [...teammates.values()].map(t => new TeammateMention(t.id, t.name));
    const spans = MentionResolver.findAddressed(text, available)
      .map(t => ({ id: t.mention.teammateId, line: text.lastIndexOf(Resources.lineSeparator, t.start - 1) + 1 }));
    const starts = [...new Set(spans.map(t => t.line))];
    const parts = starts.filter(start => spans.some(t => t.line === start && t.id === teammateId))
      .map(start => text.slice(start, starts.find(t => t > start) ?? text.length).trim());
    if (parts.length === 0)
      return this.textOf(message, teammates);
    return MentionResolver.rewrite(parts.join(Resources.transcriptSeparator), t => ParticipantContext.nameOf(t, message, teammates));
  }

  private textOf(message: Message, teammates: ReadonlyMap<string, Teammate>): string {
    return ParticipantContext.formatted(message, message.details.map(t => ParticipantContext.plainOf(t)).filter(t => Object.isString(t)).join(Resources.lineSeparator).trim(),
      teammates);
  }

  private static plainOf(detail: MessageDetail): string | null | undefined {
    return detail.kind === DetailKind.Plan ? ReplyPlan.ofDetails([detail])?.text : detail.kind === DetailKind.Text ? detail.text : null;
  }

  private static formatted(message: Message, text: string, teammates: ReadonlyMap<string, Teammate>): string {
    if (message.sender?.outside === true)
      return Resources.formatOutsideText(text, randomBytes(Resources.outsideTagIdBytes).toString("base64url"));
    return AttachmentStore.formatPrompt(MentionResolver.rewrite(text, t => ParticipantContext.nameOf(t, message, teammates)), message.attachments);
  }

  private handoverTextOf(message: Message, cut: boolean, teammates: ReadonlyMap<string, Teammate>): string {
    if (message.author === MessageAuthor.User)
      return this.textOf(message, teammates);
    const parts = message.details.filter(t => !t.isNested).flatMap(t => {
      const plain = ParticipantContext.plainOf(t);
      if (Object.isString(plain))
        return [plain];
      const result = (text: string): string => cut ? Handover.cut(text, message.sequence) : text;
      if (t.kind === DetailKind.Command || t.kind === DetailKind.FileChange || t.kind === DetailKind.SubAgent) {
        const end = t.text.indexOf(Resources.lineSeparator);
        const output = end < 0 ? String.empty : t.text.slice(end + 1).trim();
        return [[Resources.formatHandoverTool(end < 0 ? t.text : t.text.slice(0, end)), ...output.length === 0 ? [] : [result(output)]].join(Resources.lineSeparator)];
      }
      if (t.kind === DetailKind.Note && Object.isString(ParticipantContext.fieldOf(t.payload, Resources.toolUseIdField)))
        return [result(t.text)];
      return [];
    });
    return ParticipantContext.formatted(message, parts.filter(t => t.trim().length > 0).join(Resources.lineSeparator).trim(), teammates);
  }

  private askedTextOf(sent: Message, reply: Message, teammates: ReadonlyMap<string, Teammate>): string {
    const prompt = ParticipantContext.promptOf(sent);
    if (!Object.isNull(prompt))
      return prompt;
    const text = this.textOf(sent, teammates);
    const role = sent.details.filter(t => t.kind === DetailKind.Text
      && ParticipantContext.fieldOf(t.payload, Resources.organizationRoleTeammateIdField) === reply.teammateId)
      .map(t => ParticipantContext.fieldOf(t.payload, Resources.organizationRoleField)).find(t => Object.isString(t));
    return Object.isString(role) ? Resources.formatOrganizationRolePrompt(role, text) : text;
  }

  private static promptOf(message: Message): string | null {
    const prompt = message.details.filter(t => t.kind === DetailKind.Text).map(t => ParticipantContext.fieldOf(t.payload, Resources.promptField)).find(t => Object.isString(t));
    return Object.isString(prompt) ? prompt : null;
  }

  private static steeredIntoOf(message: Message): string | null {
    const into = message.details.filter(t => t.kind === DetailKind.Text).map(t => ParticipantContext.fieldOf(t.payload, Resources.steeredIntoField)).find(t => Object.isString(t));
    return Object.isString(into) ? into : null;
  }

  private static fieldOf(payload: JsonValue | null, name: string): JsonValue | undefined {
    return ParticipantContext.isJsonObject(payload) ? payload[name] : undefined;
  }

  private async chatBeforeAsync(reply: Message, continued: Message | null): Promise<readonly Message[]> {
    const end = continued ?? reply;
    return (await this.messages.listAsync(new MessageListParams(reply.conversationId, null))).filter(t => t.sequence < end.sequence);
  }

  private async teammatesAsync(): Promise<ReadonlyMap<string, Teammate>> {
    return new Map((await this.teammates.listAsync()).map(t => [t.id, t]));
  }

  private async titlesAsync(messages: readonly Message[]): Promise<Map<string, string | null>> {
    const titles = new Map<string, string | null>();
    await this.addTitlesAsync(titles, messages);
    return titles;
  }

  private async addTitlesAsync(titles: Map<string, string | null>, messages: readonly Message[]): Promise<void> {
    for (const message of messages) {
      const chatId = message.author === MessageAuthor.User ? message.sender?.conversationId : undefined;
      if (!Object.isUndefined(chatId) && !titles.has(chatId))
        titles.set(chatId, (await this.conversations.findAsync(chatId))?.title ?? null);
    }
  }

  private turnsOf(reply: Message, sent: Message, chat: readonly Message[], teammates: ReadonlyMap<string, Teammate>,
    titles: ReadonlyMap<string, string | null>): readonly HandoverTurn[] {
    const recipients = new Map<string, (string | null)[]>();
    const answered = new Set<string>();
    for (const message of chat) {
      if (message.author !== MessageAuthor.Provider || Object.isNull(message.inReplyTo))
        continue;
      if (message.teammateId === reply.teammateId)
        answered.add(message.inReplyTo);
      else
        ParticipantContext.addRecipient(recipients, message.inReplyTo, message.teammateName);
    }
    return chat.filter(t => t.id !== sent.id).flatMap(t => {
      const body = this.handoverTextOf(t, true, teammates);
      return body.length === 0 ? [] : [new HandoverTurn(t.sequence, this.prefixOf(t, titles, recipients.get(t.id), answered.has(t.id)) + body,
        t.author !== MessageAuthor.User && body !== this.handoverTextOf(t, false, teammates), ParticipantContext.hasTools(t))];
    });
  }

  private static summaryOf(chat: readonly Message[], teammateId: string | null, summary: ChatSummary): HandoverSummary | null {
    const point = ParticipantContext.pointOf(chat, teammateId);
    return Object.isUndefined(point) ? null : new HandoverSummary(summary.text, point.sequence - 1, summary.author, summary.isCompaction);
  }

  private static pointOf(chat: readonly Message[], teammateId: string | null): Message | undefined {
    return chat.findLast(t => t.teammateId === teammateId && t.details.some(d => d.kind === DetailKind.Note && Object.isNull(d.parentSequence)
      && ParticipantContext.fieldOf(d.payload, Resources.compactionField) === true));
  }

  private static isJsonObject(value: JsonValue | null): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static nameOf(token: MentionToken, message: Message, teammates: ReadonlyMap<string, Teammate>): string {
    return teammates.get(token.teammateId)?.name ?? message.mentions.find(t => t.teammateId === token.teammateId)?.name ?? token.label;
  }

  private prefixOf(message: Message, titles: ReadonlyMap<string, string | null>, to: readonly (string | null)[] = [], you: boolean = false,
    answering: boolean = false): string {
    if (message.author === MessageAuthor.User) {
      const sender = message.sender;
      if (Object.isNull(sender))
        return Resources.transcriptUserPrefix;
      if (sender.outside)
        return Resources.formatOutsideSenderPrefix(sender.name, answering);
      if (Object.isNull(sender.teammateId) && sender.name === Resources.wakeSenderName
        && message.details.some(t => !Object.isUndefined(ParticipantContext.fieldOf(t.payload, Resources.wakeIdField))))
        return Resources.wakeSenderPrefix;
      const title = titles.get(sender.conversationId) ?? null;
      return Object.isNull(sender.teammateId) ? Resources.formatDefaultSenderPrefix(sender.name, title, sender.conversationId, to, you)
        : Resources.formatSenderPrefix(sender.name, title, sender.conversationId, to, you);
    }
    return Object.isNull(message.teammateName) ? Resources.transcriptAssistantPrefix : Resources.formatParticipantLabel(message.teammateName);
  }

  private static addRecipient(recipients: Map<string, (string | null)[]>, messageId: string, name: string | null): void {
    const names = recipients.get(messageId) ?? [];
    if (!names.includes(name))
      names.unshift(name);
    recipients.set(messageId, names);
  }

  private static isPreviousReply(message: Message, reply: Message, sessionId: string, forked: boolean): boolean {
    return message.author === MessageAuthor.Provider && message.teammateId === reply.teammateId
      && message.provenance?.requested.kind === reply.provenance?.requested.kind
      && message.provenance?.providerId === reply.provenance?.providerId
      && !Object.isNullOrUndefined(message.provenance?.nativeSessionId)
      && (forked || message.provenance.nativeSessionId === sessionId);
  }
}
