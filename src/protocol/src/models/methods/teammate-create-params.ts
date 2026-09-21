/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { Harness } from "../../enums/harness.js";
import { TeammateName } from "../../services/teammate-name.js";

export class TeammateCreateParams {
  public readonly name: string;
  public readonly role: string | null;
  public readonly providerAccountId: string;
  public readonly harness: Harness;
  public readonly model: string | null;
  public readonly effort: string | null;

  public constructor(
    name: string,
    role: string | null,
    providerAccountId: string,
    harness: Harness,
    model: string | null,
    effort: string | null) {
    TeammateName.validate(name);
    if (!Object.isNull(role))
      ArgumentException.throwIfNullOrWhitespace(role, Resources.roleField);
    ArgumentException.throwIfNullOrWhitespace(providerAccountId, Resources.providerAccountIdField);
    if (!Object.values(Harness).includes(harness))
      throw new ArgumentException(Resources.invalidHarness, Resources.harnessField);
    if (!Object.isNull(model))
      ArgumentException.throwIfNullOrWhitespace(model, Resources.modelField);
    if (!Object.isNull(effort))
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortField);

    this.name = name;
    this.role = role;
    this.providerAccountId = providerAccountId;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
  }

  public static fromJson(value: unknown, path?: string): TeammateCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateCreateParams(
      TeammateName.read(reader),
      reader.readNullableString(Resources.roleField),
      reader.readNonBlankString(Resources.providerAccountIdField),
      reader.readOneOf(Resources.harnessField, Object.values(Harness)),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.roleField]: this.role,
      [Resources.providerAccountIdField]: this.providerAccountId,
      [Resources.harnessField]: this.harness,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort
    };
  }
}
