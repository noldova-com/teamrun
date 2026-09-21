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

import { Resources } from "../resources.js";
import { Harness } from "../enums/harness.js";
import { TeammateName } from "../services/teammate-name.js";

export class Teammate {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string | null;
  public readonly providerAccountId: string;
  public readonly harness: Harness;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  public constructor(
    id: string,
    name: string,
    role: string | null,
    providerAccountId: string,
    harness: Harness,
    model: string | null,
    effort: string | null,
    createdAt: string,
    updatedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
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
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);

    this.id = id;
    this.name = name;
    this.role = role;
    this.providerAccountId = providerAccountId;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static fromJson(value: unknown, path?: string): Teammate {
    const reader = JsonReader.fromValue(value, path);
    return new Teammate(
      reader.readNonBlankString(Resources.idField),
      TeammateName.read(reader),
      reader.readNullableString(Resources.roleField),
      reader.readNonBlankString(Resources.providerAccountIdField),
      reader.readOneOf(Resources.harnessField, Object.values(Harness)),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.roleField]: this.role,
      [Resources.providerAccountIdField]: this.providerAccountId,
      [Resources.harnessField]: this.harness,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt
    };
  }
}
