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

import { ModuleState } from "../enums/module-state.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class ModuleStatus {
  private static readonly STATES: readonly ModuleState[] = Object.values(ModuleState);

  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly dependencies: readonly string[];
  public readonly contributions: ReadonlyMap<string, readonly string[]>;
  public readonly state: ModuleState;
  public readonly cause: string | null;
  public readonly blockedBy: string | null;

  public constructor(
    id: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>,
    state: ModuleState,
    cause: string | null,
    blockedBy: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameField);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionField);
    if ((state === ModuleState.Active) !== Object.isNull(cause) || (!Object.isNull(cause) && String.isNullOrWhitespace(cause)))
      throw new ArgumentException(Resources.moduleCauseInvalid, Resources.causeField);
    if ((state === ModuleState.Blocked) === Object.isNull(blockedBy) || (!Object.isNull(blockedBy) && !dependencies.includes(blockedBy)))
      throw new ArgumentException(Resources.moduleBlockerInvalid, Resources.blockedByField);

    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.dependencies = [...dependencies];
    this.contributions = new Map([...contributions].map(([kind, names]) => [kind, [...names]]));
    this.state = state;
    this.cause = cause;
    this.blockedBy = blockedBy;
  }

  public static fromJson(value: unknown, path?: string): ModuleStatus {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => {
      const contributes = reader.readObject(Resources.contributesField);
      return new ModuleStatus(
        reader.readString(Resources.idField),
        reader.readString(Resources.displayNameField),
        reader.readString(Resources.descriptionField),
        reader.readStringArray(Resources.dependenciesField),
        new Map(Object.keys(contributes.toJson()).map(t => [t, contributes.readStringArray(t)])),
        reader.readOneOf(Resources.stateField, ModuleStatus.STATES),
        reader.hasField(Resources.causeField) ? reader.readString(Resources.causeField) : null,
        reader.hasField(Resources.blockedByField) ? reader.readString(Resources.blockedByField) : null);
    });
  }

  public listContributions(kind: string): readonly string[] {
    return this.contributions.get(kind) ?? [];
  }

  public withState(state: ModuleState, cause: string | null, blockedBy: string | null = null): ModuleStatus {
    return new ModuleStatus(this.id, this.displayName, this.description, this.dependencies, this.contributions, state, cause, blockedBy);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.displayNameField]: this.displayName,
      [Resources.descriptionField]: this.description,
      [Resources.dependenciesField]: [...this.dependencies],
      [Resources.contributesField]: Object.fromEntries([...this.contributions].map(([kind, names]) => [kind, [...names]])),
      [Resources.stateField]: this.state,
      ...Object.isNull(this.cause) ? {} : { [Resources.causeField]: this.cause },
      ...Object.isNull(this.blockedBy) ? {} : { [Resources.blockedByField]: this.blockedBy }
    };
  }
}
