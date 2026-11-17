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

import { Resources } from "../../resources.js";
import { Harness } from "../../enums/harness.js";
import { ProviderContextWindows } from "../provider-context-windows.js";
import { Teammate } from "../teammate.js";
import { TeammateFallback } from "../teammate-fallback.js";
import { TeammateName } from "../../services/teammate-name.js";
import { UsageHandOffs } from "../../services/usage-hand-offs.js";

export class TeammateCreateParams {
  public readonly name: string;
  public readonly role: string | null;
  public readonly providerId: string;
  public readonly harness: Harness;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly speed: string | null;
  public readonly mode: string | null;
  public readonly contextWindow: number | null;
  public readonly usageHandOffs: readonly string[];
  public readonly sustain: boolean;
  public readonly fallbacks: readonly TeammateFallback[];
  public readonly resetsSoonestFirst: boolean;

  public constructor(
    name: string,
    role: string | null,
    providerId: string,
    harness: Harness,
    model: string | null,
    effort: string | null,
    speed: string | null = null,
    mode: string | null = null,
    contextWindow: number | null = null,
    usageHandOffs: readonly string[] = [],
    sustain: boolean = false,
    fallbacks: readonly TeammateFallback[] = [],
    resetsSoonestFirst: boolean = true) {
    TeammateName.validate(name);
    if (!Object.isNull(role))
      ArgumentException.throwIfNullOrWhitespace(role, Resources.roleField);
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    if (!Object.values(Harness).includes(harness))
      throw new ArgumentException(Resources.invalidHarness, Resources.harnessField);
    if (!Object.isNull(model))
      ArgumentException.throwIfNullOrWhitespace(model, Resources.modelField);
    if (!Object.isNull(effort))
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortField);
    if (!Object.isNull(speed))
      ArgumentException.throwIfNullOrWhitespace(speed, Resources.speedField);
    if (!Object.isNull(mode))
      ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeField);
    if (!Object.isNull(contextWindow) && !ProviderContextWindows.isSize(contextWindow))
      throw new ArgumentException(Resources.chosenContextWindowInvalid, Resources.contextWindowField);

    this.name = name;
    this.role = role;
    this.providerId = providerId;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.speed = speed;
    this.mode = mode;
    this.contextWindow = contextWindow;
    this.usageHandOffs = UsageHandOffs.validate(usageHandOffs);
    this.sustain = sustain;
    this.fallbacks = [...fallbacks];
    this.resetsSoonestFirst = resetsSoonestFirst;
  }

  public static fromJson(value: unknown, path?: string): TeammateCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateCreateParams(
      TeammateName.read(reader),
      reader.readNullableString(Resources.roleField),
      reader.readNonBlankString(Resources.providerIdField),
      reader.readOneOf(Resources.harnessField, Object.values(Harness)),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField),
      reader.hasField(Resources.speedField) ? reader.readNullableString(Resources.speedField) : null,
      reader.hasField(Resources.modeField) ? reader.readNullableString(Resources.modeField) : null,
      reader.hasField(Resources.contextWindowField) ? reader.readNullableInteger(Resources.contextWindowField) : null,
      reader.hasField(Resources.usageHandOffsField) ? reader.readStringArray(Resources.usageHandOffsField) : [],
      reader.hasField(Resources.sustainField) && reader.readBoolean(Resources.sustainField),
      reader.hasField(Resources.fallbacksField) ? TeammateFallback.readList(reader) : [],
      !reader.hasField(Resources.resetsSoonestFirstField) || reader.readBoolean(Resources.resetsSoonestFirstField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.roleField]: this.role,
      [Resources.providerIdField]: this.providerId,
      [Resources.harnessField]: this.harness,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.speedField]: this.speed,
      [Resources.modeField]: this.mode,
      ...Object.isNull(this.contextWindow) ? {} : { [Resources.contextWindowField]: this.contextWindow },
      ...this.usageHandOffs.length === 0 ? {} : { [Resources.usageHandOffsField]: [...this.usageHandOffs] },
      ...Teammate.sustainJson(this.sustain, this.fallbacks, this.resetsSoonestFirst)
    };
  }
}
