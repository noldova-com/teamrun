/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { Harness } from "../../enums/harness.js";
import type { ITeammateChanges } from "../../interfaces/i-teammate-changes.js";
import { ProviderContextWindows } from "../provider-context-windows.js";
import { Teammate } from "../teammate.js";
import { TeammateFallback } from "../teammate-fallback.js";
import { TeammateName } from "../../services/teammate-name.js";
import { UsageHandOffs } from "../../services/usage-hand-offs.js";

export class TeammateUpdateParams {
  private static readonly FIELDS: readonly string[] = [Resources.teammateIdField, Resources.nameField, Resources.roleField, Resources.providerIdField,
    Resources.harnessField, Resources.modelField, Resources.effortField, Resources.speedField, Resources.modeField, Resources.expectedProviderIdField,
    Resources.contextWindowField, Resources.usageHandOffsField, Resources.sustainField, Resources.fallbacksField, Resources.resetsSoonestFirstField];

  public readonly teammateId: string;
  public readonly name: string | undefined;
  public readonly role: string | null | undefined;
  public readonly providerId: string | undefined;
  public readonly harness: Harness | undefined;
  public readonly model: string | null | undefined;
  public readonly effort: string | null | undefined;
  public readonly speed: string | null | undefined;
  public readonly mode: string | null | undefined;
  public readonly expectedProviderId: string | undefined;
  public readonly contextWindow: number | null | undefined;
  public readonly usageHandOffs: readonly string[] | undefined;
  public readonly sustain: boolean | undefined;
  public readonly fallbacks: readonly TeammateFallback[] | undefined;
  public readonly resetsSoonestFirst: boolean | undefined;

  public constructor(
    teammateId: string,
    name: string | undefined,
    role: string | null | undefined,
    providerId: string | undefined,
    harness: Harness | undefined,
    model: string | null | undefined,
    effort: string | null | undefined,
    speed?: string | null,
    mode?: string | null,
    expectedProviderId?: string,
    contextWindow?: number | null,
    usageHandOffs?: readonly string[],
    sustain?: boolean,
    fallbacks?: readonly TeammateFallback[],
    resetsSoonestFirst?: boolean) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if ([name, role, providerId, harness, model, effort, speed, mode, contextWindow, usageHandOffs, sustain, fallbacks, resetsSoonestFirst].every(t => Object.isUndefined(t)))
      throw new ArgumentException(Resources.emptyTeammateUpdate, Resources.teammateIdField);
    if (!Object.isUndefined(expectedProviderId))
      ArgumentException.throwIfNullOrWhitespace(expectedProviderId, Resources.expectedProviderIdField);
    if (Object.isUndefined(providerId) && Object.isUndefined(expectedProviderId) && [model, effort, speed, mode, contextWindow].some(t => !Object.isUndefined(t)))
      throw new ArgumentException(Resources.teammateUpdateProviderUnread, Resources.expectedProviderIdField);
    if (!Object.isUndefined(name))
      TeammateName.validate(name);
    if (!Object.isNullOrUndefined(role))
      ArgumentException.throwIfNullOrWhitespace(role, Resources.roleField);
    if (!Object.isUndefined(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    if (!Object.isUndefined(harness) && !Object.values(Harness).includes(harness))
      throw new ArgumentException(Resources.invalidHarness, Resources.harnessField);
    if (!Object.isNullOrUndefined(model))
      ArgumentException.throwIfNullOrWhitespace(model, Resources.modelField);
    if (!Object.isNullOrUndefined(effort))
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortField);
    if (!Object.isNullOrUndefined(speed))
      ArgumentException.throwIfNullOrWhitespace(speed, Resources.speedField);
    if (!Object.isNullOrUndefined(mode))
      ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeField);
    if (!Object.isNullOrUndefined(contextWindow) && !ProviderContextWindows.isSize(contextWindow))
      throw new ArgumentException(Resources.chosenContextWindowInvalid, Resources.contextWindowField);
    if (usageHandOffs?.includes(teammateId) === true)
      throw new ArgumentException(Resources.usageHandOffToSelf, Resources.usageHandOffsField);

    this.teammateId = teammateId;
    this.name = name;
    this.role = role;
    this.providerId = providerId;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.speed = speed;
    this.mode = mode;
    this.expectedProviderId = expectedProviderId;
    this.contextWindow = contextWindow;
    this.usageHandOffs = Object.isUndefined(usageHandOffs) ? undefined : UsageHandOffs.validate(usageHandOffs);
    this.sustain = sustain;
    this.fallbacks = Object.isUndefined(fallbacks) ? undefined : [...fallbacks];
    this.resetsSoonestFirst = resetsSoonestFirst;
  }

  public static of(teammateId: string, changes: ITeammateChanges, expectedProviderId?: string): TeammateUpdateParams {
    return new TeammateUpdateParams(teammateId, changes.name, changes.role, changes.providerId, changes.harness, changes.model, changes.effort, changes.speed,
      changes.mode, expectedProviderId, changes.contextWindow, changes.usageHandOffs, changes.sustain, changes.fallbacks, changes.resetsSoonestFirst);
  }

  public static changing(teammate: Teammate, wanted: ITeammateChanges, readProviderId: string = teammate.providerId): TeammateUpdateParams | null {
    const { usageHandOffs, fallbacks, ...fields } = wanted;
    const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== teammate[key as keyof ITeammateChanges])) as ITeammateChanges;
    const handOffs = Object.isUndefined(usageHandOffs) || UsageHandOffs.same(usageHandOffs, teammate.usageHandOffs) ? {} : { usageHandOffs };
    const entries = Object.isUndefined(fallbacks) || TeammateUpdateParams.sameFallbacks(fallbacks, teammate.fallbacks) ? {} : { fallbacks };
    const changes: ITeammateChanges = { ...changed, ...handOffs, ...entries };
    if (Object.keys(changes).length === 0)
      return null;
    const providerBound = [changes.model, changes.effort, changes.speed, changes.mode, changes.contextWindow].some(t => !Object.isUndefined(t));
    return providerBound ? TeammateUpdateParams.of(teammate.id, changes, readProviderId) : TeammateUpdateParams.of(teammate.id, changes);
  }

  public static fromJson(value: unknown, path?: string): TeammateUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    const unknown = Object.keys(reader.toJson() as JsonObject).find(t => !TeammateUpdateParams.FIELDS.includes(t));
    if (!Object.isUndefined(unknown))
      throw new ArgumentException(Resources.formatUnknownTeammateUpdateField(unknown), unknown);
    const nullable = (field: string): string | null | undefined => reader.hasField(field) ? reader.readNullableString(field) : undefined;
    return new TeammateUpdateParams(
      reader.readNonBlankString(Resources.teammateIdField),
      reader.hasField(Resources.nameField) ? TeammateName.read(reader) : undefined,
      nullable(Resources.roleField),
      reader.hasField(Resources.providerIdField) ? reader.readNonBlankString(Resources.providerIdField) : undefined,
      reader.hasField(Resources.harnessField) ? reader.readOneOf(Resources.harnessField, Object.values(Harness)) : undefined,
      nullable(Resources.modelField),
      nullable(Resources.effortField),
      nullable(Resources.speedField),
      nullable(Resources.modeField),
      reader.hasField(Resources.expectedProviderIdField) ? reader.readNonBlankString(Resources.expectedProviderIdField) : undefined,
      reader.hasField(Resources.contextWindowField) ? reader.readNullableInteger(Resources.contextWindowField) : undefined,
      reader.hasField(Resources.usageHandOffsField) ? reader.readStringArray(Resources.usageHandOffsField) : undefined,
      reader.hasField(Resources.sustainField) ? reader.readBoolean(Resources.sustainField) : undefined,
      reader.hasField(Resources.fallbacksField) ? TeammateFallback.readList(reader) : undefined,
      reader.hasField(Resources.resetsSoonestFirstField) ? reader.readBoolean(Resources.resetsSoonestFirstField) : undefined);
  }

  public applyTo(teammate: Teammate, updatedAt: string): Teammate {
    const kept = <T>(value: T | undefined, own: T): T => Object.isUndefined(value) ? own : value;
    return new Teammate(teammate.id, kept(this.name, teammate.name), kept(this.role, teammate.role), kept(this.providerId, teammate.providerId),
      kept(this.harness, teammate.harness), kept(this.model, teammate.model), kept(this.effort, teammate.effort), teammate.createdAt, updatedAt,
      kept(this.speed, teammate.speed), kept(this.mode, teammate.mode), kept(this.contextWindow, teammate.contextWindow),
      kept(this.usageHandOffs, teammate.usageHandOffs), kept(this.sustain, teammate.sustain), kept(this.fallbacks, teammate.fallbacks),
      kept(this.resetsSoonestFirst, teammate.resetsSoonestFirst));
  }

  public toJson(): JsonObject {
    const fields: [string, JsonValue | undefined][] = [
      [Resources.nameField, this.name],
      [Resources.roleField, this.role],
      [Resources.providerIdField, this.providerId],
      [Resources.harnessField, this.harness],
      [Resources.modelField, this.model],
      [Resources.effortField, this.effort],
      [Resources.speedField, this.speed],
      [Resources.modeField, this.mode],
      [Resources.expectedProviderIdField, this.expectedProviderId],
      [Resources.contextWindowField, this.contextWindow],
      [Resources.usageHandOffsField, Object.isUndefined(this.usageHandOffs) ? undefined : [...this.usageHandOffs]],
      [Resources.sustainField, this.sustain],
      [Resources.fallbacksField, this.fallbacks?.map(t => t.toJson())],
      [Resources.resetsSoonestFirstField, this.resetsSoonestFirst]
    ];
    const named = fields.flatMap(([field, value]): [string, JsonValue][] => Object.isUndefined(value) ? [] : [[field, value]]);
    return { [Resources.teammateIdField]: this.teammateId, ...Object.fromEntries(named) };
  }

  private static sameFallbacks(wanted: readonly TeammateFallback[], own: readonly TeammateFallback[]): boolean {
    return wanted.length === own.length && wanted.every((t, i) => own[i]?.equals(t) === true);
  }
}
