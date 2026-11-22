/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { CommandContribution, type IWindowPartContext } from "@noldova/desktop.window";
import { ConversationIdParams, EventName, MethodName, Resources as ProtocolResources, RunOutput } from "@noldova/teamrun.protocol";
import { TerminalOwners, TerminalRunOutput, type TerminalShellKind } from "@noldova/terminal.window";
import type { ShellRun } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ChatAction } from "../enums/chat-action";
import { ListNotArrayException } from "../exceptions/list-not-array.exception";
import type { IKeptRuns } from "../interfaces/i-kept-runs";
import type { IRunPlace } from "../interfaces/i-run-place";
import type { IRunStarter } from "../interfaces/i-run-starter";
import type { IStoredRun } from "../interfaces/i-stored-run";
import type { ITerminalRunner } from "../interfaces/i-terminal-runner";
import type { ChatStoreService } from "./chat-store.service";
import type { InlineTerminals } from "./inline-terminals";

export class ChatTerminals {
  private static readonly provided: WeakMap<IWindowPartContext, ChatTerminals> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly owners: TerminalOwners;
  private readonly runner: ITerminalRunner;
  private readonly inline: InlineTerminals | null;
  private readonly unwatch: () => void;
  private readonly unwatchDeleted: () => void;

  private constructor(context: IWindowPartContext, store: ChatStoreService, runner: ITerminalRunner | null,
    inline: ((starter: IRunStarter, kept: IKeptRuns) => InlineTerminals) | null) {
    this.context = context;
    this.store = store;
    this.owners = TerminalOwners.provide(context, () => this.newOwner());
    this.runner = runner ?? this.owners;
    this.inline = inline?.(this.owners, { listAsync: t => this.listKeptAsync(t), save: (owner, run) => this.keepAsync(owner, run) }) ?? null;
    this.unwatch = store.onShownConversationChanged(t => this.show(t));
    this.unwatchDeleted = context.onEvent(Resources.formatQualifiedName(EventName.ConversationDeleted), t => this.close(ConversationIdParams.fromJson(t).conversationId));
    this.show(store.shownConversationId());
  }

  public static provide(context: IWindowPartContext, store: ChatStoreService, runner: ITerminalRunner | null = null,
    inline: ((starter: IRunStarter, kept: IKeptRuns) => InlineTerminals) | null = null): ChatTerminals {
    const terminals = new ChatTerminals(context, store, runner, inline);
    ChatTerminals.provided.set(context, terminals);
    return terminals;
  }

  public static of(context: IWindowPartContext): ChatTerminals | null {
    return ChatTerminals.provided.get(context) ?? null;
  }

  public static ownerOf(conversationId: string | null): string | null {
    return Object.isNull(conversationId) ? null : ChatTerminals.ownerFor(conversationId);
  }

  public static ownerFor(conversationId: string): string {
    return `${ProtocolResources.chatTerminalOwnerPrefix}${conversationId}`;
  }

  public command(): CommandContribution {
    return new CommandContribution(Resources.newChatTerminalCommand, Resources.newChatTerminalTitle, Resources.newChatTerminalIcon,
      Resources.newChatTerminalKey, t => this.openAsync(t), () => !Object.isNull(this.store.shownConversationId()));
  }

  public get inlineTerminals(): InlineTerminals | null {
    return this.inline;
  }

  public run(conversationId: string, run: ShellRun, place: IRunPlace | null = null): void {
    void this.runAsync(conversationId, run, place);
  }

  public answerBusy(owner: string, stop: boolean): void {
    const conversationId = ChatTerminals.conversationOf(owner);
    this.inline?.answerBusyAsync(owner, stop).catch((error: unknown) =>
      this.store.reportFailure(ChatAction.RunCode, conversationId, ChatTerminals.messageOf(error), conversationId));
  }

  public async removeAsync(): Promise<void> {
    if (ChatTerminals.provided.get(this.context) === this)
      ChatTerminals.provided.delete(this.context);
    this.unwatch();
    this.unwatchDeleted();
    this.inline?.dispose();
    await this.owners.removeAsync();
  }

  private newOwner(): string | null {
    return this.context.readSetting(Resources.newTerminalsSetting) === Resources.chatNewTerminals ? ChatTerminals.ownerOf(this.store.shownConversationId()) : null;
  }

  private async openAsync(commandArguments: JsonValue): Promise<JsonValue> {
    const owner = ChatTerminals.ownerOf(this.store.shownConversationId());
    if (Object.isNull(owner))
      return null;
    const tabGroup: unknown = Object.isObject(commandArguments) && !Array.isArray(commandArguments)
      ? Reflect.get(commandArguments, Resources.terminalTabGroupField) : null;
    await this.context.runCommandAsync(Resources.terminalNewCommand, Object.isString(tabGroup)
      ? { [Resources.terminalOwnerField]: owner, [Resources.terminalTabGroupField]: tabGroup } : { [Resources.terminalOwnerField]: owner });
    return null;
  }

  private async runAsync(conversationId: string, run: ShellRun, place: IRunPlace | null): Promise<void> {
    const kinds = Resources.shellRunKinds.get(run.language.toLowerCase()) ?? [];
    const refusal = this.refusalOf(run, kinds);
    if (!Object.isNull(refusal)) {
      this.store.reportFailure(ChatAction.RunCode, conversationId, refusal, conversationId);
      return;
    }
    try {
      const owner = ChatTerminals.ownerFor(conversationId);
      const folder = this.store.folderOf(conversationId);
      const inline = this.inlineRunner();
      await (Object.isNull(inline) ? this.runner.runAsync(owner, run.code, folder, kinds) : inline.runAsync(owner, run.code, folder, kinds, place));
    }
    catch (error) {
      this.store.reportFailure(ChatAction.RunCode, conversationId, ChatTerminals.messageOf(error), conversationId);
    }
  }

  private inlineRunner(): InlineTerminals | null {
    return this.context.readSetting(Resources.runOpensInSetting) === Resources.runOpensInPanel ? null : this.inline;
  }

  private refusalOf(run: ShellRun, kinds: readonly TerminalShellKind[]): string | null {
    if (String.isNullOrWhitespace(run.code))
      return Resources.shellRunEmpty;
    if (!TerminalOwners.canRun(run.code))
      return Resources.shellRunRefused;
    return kinds.length === 0 ? Resources.formatShellRunUnknown(run.language) : null;
  }

  private close(conversationId: string): void {
    this.inline?.close(ChatTerminals.ownerFor(conversationId));
    this.owners.closeAsync(ChatTerminals.ownerFor(conversationId)).catch((error: unknown) =>
      this.store.reportFailure(ChatAction.CloseTerminals, conversationId, ChatTerminals.messageOf(error), null));
  }

  private show(conversationId: string | null): void {
    void this.showAsync(conversationId);
  }

  private async showAsync(conversationId: string | null): Promise<void> {
    this.inline?.show(ChatTerminals.ownerOf(conversationId));
    try {
      await this.owners.showAsync(ChatTerminals.ownerOf(conversationId));
    }
    catch (error) {
      this.store.reportFailure(ChatAction.ShowTerminals, this.store.windowId, ChatTerminals.messageOf(error), conversationId);
    }
  }

  private async listKeptAsync(owner: string): Promise<readonly IStoredRun[]> {
    const conversationId = ChatTerminals.conversationOf(owner);
    try {
      const listed = await this.context.requestAsync(Resources.formatQualifiedName(MethodName.RunOutputList), new ConversationIdParams(conversationId).toJson());
      if (!Array.isArray(listed))
        throw new ListNotArrayException(Resources.formatValueKind(listed));
      return listed.map(t => RunOutput.fromJson(t)).map(t => ({
        place: { messageId: t.messageId, site: t.site, block: t.block }, output: TerminalRunOutput.fromJson(t.output)
      }));
    }
    catch (error) {
      this.store.reportFailure(ChatAction.ShowRunOutputs, conversationId, ChatTerminals.messageOf(error), conversationId);
      return [];
    }
  }

  private async keepAsync(owner: string, run: IStoredRun): Promise<void> {
    const conversationId = ChatTerminals.conversationOf(owner);
    const output = new RunOutput(conversationId, run.place.messageId, run.place.site, run.place.block, run.output.toJson());
    try {
      await this.context.requestAsync(Resources.formatQualifiedName(MethodName.RunOutputSave), output.toJson());
    }
    catch (error) {
      this.store.reportFailure(ChatAction.KeepRunOutput, conversationId, ChatTerminals.messageOf(error), conversationId);
    }
  }

  private static conversationOf(owner: string): string {
    return owner.slice(ProtocolResources.chatTerminalOwnerPrefix.length);
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
