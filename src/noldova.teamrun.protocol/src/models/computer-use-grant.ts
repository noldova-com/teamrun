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

import { Resources } from "../resources.js";

export class ComputerUseGrant {
  public readonly id: string;
  public readonly chatId: string;
  public readonly chatTitle: string | null;
  public readonly teammateName: string | null;
  public readonly app: string | null;
  public readonly appName: string | null;
  public readonly appIcon: string | null;
  public readonly grantedAt: string;

  public constructor(id: string, chatId: string, chatTitle: string | null, teammateName: string | null, app: string | null, appName: string | null,
    appIcon: string | null, grantedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(app))
      ArgumentException.throwIfNullOrWhitespace(app, Resources.appField);
    if (!Object.isNull(appName))
      ArgumentException.throwIfNullOrWhitespace(appName, Resources.appNameField);
    if (!Object.isNull(appIcon))
      ArgumentException.throwIfNullOrWhitespace(appIcon, Resources.appIconField);
    if (Object.isNull(app) && (!Object.isNull(appName) || !Object.isNull(appIcon)))
      throw new ArgumentException(Resources.screenGrantDescribed, Resources.appField);
    ArgumentException.throwIfNullOrWhitespace(grantedAt, Resources.grantedAtField);

    this.id = id;
    this.chatId = chatId;
    this.chatTitle = chatTitle;
    this.teammateName = teammateName;
    this.app = app;
    this.appName = appName;
    this.appIcon = appIcon;
    this.grantedAt = grantedAt;
  }

  public static fromJson(value: unknown, path?: string): ComputerUseGrant {
    const reader = JsonReader.fromValue(value, path);
    return new ComputerUseGrant(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNullableString(Resources.chatTitleField),
      reader.readNullableString(Resources.teammateNameField),
      reader.readNullableString(Resources.appField),
      reader.readNullableString(Resources.appNameField),
      reader.readNullableString(Resources.appIconField),
      reader.readNonBlankString(Resources.grantedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.chatIdField]: this.chatId,
      [Resources.chatTitleField]: this.chatTitle,
      [Resources.teammateNameField]: this.teammateName,
      [Resources.appField]: this.app,
      [Resources.appNameField]: this.appName,
      [Resources.appIconField]: this.appIcon,
      [Resources.grantedAtField]: this.grantedAt
    };
  }
}
