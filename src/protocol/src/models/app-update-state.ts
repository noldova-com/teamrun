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

import { AppUpdateStatus } from "../enums/app-update-status.js";
import { Resources } from "../resources.js";

export class AppUpdateState {
  public readonly status: AppUpdateStatus;
  public readonly currentVersion: string;
  public readonly availableVersion: string | null;
  public readonly progressPercent: number | null;
  public readonly message: string | null;
  public readonly lastCheckedAt: string | null;
  public readonly isTestFeed: boolean;
  public readonly canInstall: boolean;

  public constructor(status: AppUpdateStatus, currentVersion: string, availableVersion: string | null,
    progressPercent: number | null, message: string | null, lastCheckedAt: string | null, isTestFeed: boolean, canInstall: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(currentVersion, Resources.currentVersionField);
    if (!Object.isNull(availableVersion))
      ArgumentException.throwIfNullOrWhitespace(availableVersion, Resources.availableVersionField);
    if (!Object.isNull(progressPercent) && (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > Resources.fullUpdateProgress))
      throw new ArgumentException(Resources.invalidUpdateProgress, Resources.progressPercentField);

    this.status = status;
    this.currentVersion = currentVersion;
    this.availableVersion = availableVersion;
    this.progressPercent = progressPercent;
    this.message = message;
    this.lastCheckedAt = lastCheckedAt;
    this.isTestFeed = isTestFeed;
    this.canInstall = canInstall;
  }

  public static fromJson(value: unknown, path?: string): AppUpdateState {
    const reader = JsonReader.fromValue(value, path);
    return new AppUpdateState(reader.readOneOf(Resources.statusField, Object.values(AppUpdateStatus)),
      reader.readNonBlankString(Resources.currentVersionField), reader.readNullableString(Resources.availableVersionField),
      reader.readNullableInteger(Resources.progressPercentField), reader.readNullableString(Resources.messageField),
      reader.readNullableString(Resources.lastCheckedAtField), reader.readBoolean(Resources.isTestFeedField),
      reader.hasField(Resources.canInstallField) ? reader.readBoolean(Resources.canInstallField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.statusField]: this.status,
      [Resources.currentVersionField]: this.currentVersion,
      [Resources.availableVersionField]: this.availableVersion,
      [Resources.progressPercentField]: this.progressPercent,
      [Resources.messageField]: this.message,
      [Resources.lastCheckedAtField]: this.lastCheckedAt,
      [Resources.isTestFeedField]: this.isTestFeed,
      [Resources.canInstallField]: this.canInstall
    };
  }
}
