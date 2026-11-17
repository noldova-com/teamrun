/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Readable } from "node:stream";
import { text as readText } from "node:stream/consumers";
import type { ReadStream } from "node:tty";

import { CliCommandException, CliCommandResult, UsageException } from "@noldova/desktop.cli";
import {
  DefaultTeammate, MentionResolver, MessageSendParams, MessageSendResult, MethodName, ProviderAbility, ProviderKind, type ProviderModel,
  Resources as ProtocolResources, RequestedSettings, SenderEnvironment, Teammate, TeammateMention, TeammateName
} from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class SendCommand extends TeamRunCommand {
  public readonly name: string = Resources.sendCommand;
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly input: Readable;

  public constructor(client: RuntimeClient, environment: Readonly<Record<string, string | undefined>>, input: Readable) {
    super(client);
    this.environment = environment;
    this.input = input;
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const words = values.readWords(Resources.textValue);
    const text = words === Resources.inputArgument ? await this.readInputAsync() : words;
    const token = SenderEnvironment.read(this.environment);
    const teammates = await this.client.listAsync(MethodName.TeammateList, null, signal, t => Teammate.fromJson(t));
    const available = teammates.map(t => new TeammateMention(t.id, t.name));
    const mentioned = (Object.isNull(token) ? MentionResolver.resolve(text, available) : MentionResolver.resolveTeammateText(text, available)).map(t => t.teammateId);
    const responder = values.readOptionalText(Resources.teammateValue);
    const responderId = Object.isNull(responder) ? null : SendCommand.findTeammate(teammates, responder).id;
    const kind = values.readOptionalText(Resources.kindValue);
    const named = mentioned.length > 0 || !Object.isNull(responderId);
    const fallback = named || !Object.isNull(kind) || !Object.isNull(token) ? null : await this.readDefaultAsync(signal);
    if (!named && Object.isNull(kind) && Object.isNull(token) && Object.isNull(fallback))
      throw new UsageException(Resources.noResponder);
    const given = values.readOptionalText(Resources.providerValue);
    if (!named && !Object.isNull(kind) && Object.isNull(given) && Object.isNull(token))
      throw new UsageException(Resources.kindNeedsProvider);
    if (!Object.isNull(fallback) && Object.isNull(fallback.providerId) && Object.isNull(given))
      throw new UsageException(Resources.defaultNeedsProvider);
    const requested = named
      ? null
      : Object.isNull(fallback) ? SendCommand.requestedOf(values, kind) : await this.requestedForDefaultAsync(values, fallback, given, signal);
    if (!Object.isNull(requested) && !Object.isNull(values.readOptionalText(Resources.effortValue)))
      await this.refuseEffortAsync(requested.kind, signal);
    const provider = named ? null : given ?? fallback?.providerId ?? null;
    const params = new MessageSendParams(values.readText(Resources.chatIdValue), text, requested, provider, [], mentioned, responderId, token);
    const result = MessageSendResult.fromJson(await this.client.requestAsync(MethodName.MessageSend, params.toJson(), signal));
    return new CliCommandResult(result.toJson(), Resources.formatSent(result));
  }

  private async refuseEffortAsync(kind: string, signal: AbortSignal): Promise<void> {
    const found = (await this.client.listAsync(MethodName.ProviderKindList, null, signal, t => ProviderKind.fromJson(t))).find(t => t.id === kind);
    if (Object.isUndefined(found))
      return;
    const reason = found.reasonAgainst(ProviderAbility.ChooseEffort);
    if (!Object.isNull(reason))
      throw new UsageException(ProtocolResources.formatAbilityRefused(found.displayName, Resources.changeEffortAction, reason));
  }

  private async readDefaultAsync(signal: AbortSignal): Promise<DefaultTeammate | null> {
    const read = await this.client.requestAsync(MethodName.DefaultTeammateRead, null, signal);
    return Object.isNull(read) ? null : DefaultTeammate.fromJson(read);
  }

  private async requestedForDefaultAsync(values: CommandValues, fallback: DefaultTeammate, providerId: string | null,
    signal: AbortSignal): Promise<RequestedSettings> {
    const model = values.readOptionalText(Resources.modelValue);
    const effort = values.readOptionalText(Resources.effortValue);
    const own = fallback.requested;
    if (Object.isNull(providerId) || providerId === fallback.providerId)
      return new RequestedSettings(own.kind, model ?? own.model, effort ?? (Object.isNull(model) ? own.effort : null),
        Object.isNull(model) ? own.speed : await this.speedOnAsync(own, fallback.providerId, model, signal), own.mode);
    const provider = await this.client.findProviderAsync(providerId, signal);
    if (provider.kind !== own.kind)
      return new RequestedSettings(provider.kind, model, effort);
    if (!Object.isNull(model))
      return new RequestedSettings(provider.kind, model, effort, await this.speedOnAsync(own, providerId, model, signal), own.mode);
    const catalog = await this.client.readModelsAsync(own.kind, providerId, signal);
    const listed = catalog.models.find(t => Object.isNull(own.model) ? t.isDefault : t.id === own.model);
    if (Object.isUndefined(listed))
      return new RequestedSettings(own.kind, null, effort, null, own.mode);

    const listedEffort = !Object.isNull(own.effort) && (listed.effortLevels ?? []).includes(own.effort) ? own.effort : null;
    return new RequestedSettings(own.kind, own.model, effort ?? listedEffort, SendCommand.speedIn(listed, own.speed), own.mode);
  }

  private async speedOnAsync(own: RequestedSettings, providerId: string | null, model: string, signal: AbortSignal): Promise<string | null> {
    if (Object.isNull(own.speed))
      return null;
    const catalog = await this.client.readModelsAsync(own.kind, providerId, signal);
    return SendCommand.speedIn(catalog.models.find(t => t.matches(model)), own.speed);
  }

  private static speedIn(model: ProviderModel | undefined, speed: string | null): string | null {
    return model?.speeds.some(t => t.id === speed) === true ? speed : null;
  }

  private async readInputAsync(): Promise<string> {
    if ((this.input as Partial<ReadStream>).isTTY === true)
      throw new UsageException(Resources.terminalInput);
    const text = (await readText(this.input)).replace(Resources.byteOrderMarkPattern, String.empty)
      .replaceAll(Resources.windowsLineSeparator, Resources.lineSeparator).replace(Resources.finalLineSeparatorPattern, String.empty);
    if (text.length === 0)
      throw new UsageException(Resources.emptyInput);

    return text;
  }

  private static requestedOf(values: CommandValues, kind: string | null): RequestedSettings | null {
    return Object.isNull(kind)
      ? null
      : new RequestedSettings(kind, values.readOptionalText(Resources.modelValue), values.readOptionalText(Resources.effortValue));
  }

  private static findTeammate(teammates: readonly Teammate[], name: string): Teammate {
    const found = teammates.find(t => TeammateName.key(t.name) === TeammateName.key(name));
    if (Object.isUndefined(found))
      throw new CliCommandException(Resources.notFoundCode, Resources.formatTeammateNotFound(name));

    return found;
  }
}
