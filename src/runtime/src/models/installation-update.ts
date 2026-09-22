/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { InstallationUpdatePhase } from "../enums/installation-update-phase.js";
import { Resources } from "../resources.js";

export class InstallationUpdate {
  public readonly id: string;
  public readonly ownerId: string;
  public readonly targetVersion: string;
  public readonly phase: InstallationUpdatePhase;
  public readonly expiresAt: number;

  public constructor(id: string, ownerId: string, targetVersion: string, phase: InstallationUpdatePhase, expiresAt: number) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.installationIdField);
    ArgumentException.throwIfNullOrWhitespace(ownerId, Resources.installationOwnerField);
    ArgumentException.throwIfNullOrWhitespace(targetVersion, Resources.installationTargetField);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(expiresAt, Resources.installationExpiryField);

    this.id = id;
    this.ownerId = ownerId;
    this.targetVersion = targetVersion;
    this.phase = phase;
    this.expiresAt = expiresAt;
  }

  public static fromJson(value: unknown): InstallationUpdate {
    const reader = JsonReader.fromValue(value);
    return new InstallationUpdate(reader.readNonBlankString(Resources.installationIdField), reader.readNonBlankString(Resources.installationOwnerField),
      reader.readNonBlankString(Resources.installationTargetField), reader.readOneOf(Resources.installationPhaseField, Object.values(InstallationUpdatePhase)),
      reader.readInteger(Resources.installationExpiryField));
  }

  public toJson(): JsonObject {
    return { [Resources.installationIdField]: this.id, [Resources.installationOwnerField]: this.ownerId, [Resources.installationTargetField]: this.targetVersion,
      [Resources.installationPhaseField]: this.phase, [Resources.installationExpiryField]: this.expiresAt };
  }
}
