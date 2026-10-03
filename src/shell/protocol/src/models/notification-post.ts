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

import { NotificationSeverity } from "../enums/notification-severity.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { CommandRun } from "./command-run.js";
import { NotificationAction } from "./notification-action.js";
import { QualifiedName } from "./qualified-name.js";

export class NotificationPost {
  public static readonly maximumActions: number = 2;
  public static readonly indeterminate: "indeterminate" = "indeterminate";

  private static readonly SEVERITIES: readonly NotificationSeverity[] = Object.values(NotificationSeverity);
  private static readonly FIELDS: readonly string[] = [
    Resources.kindField, Resources.keyField, Resources.titleField, Resources.textField, Resources.severityField,
    Resources.openField, Resources.actionsField, Resources.progressField
  ];

  public readonly kind: QualifiedName;
  public readonly key: string | null;
  public readonly title: string;
  public readonly text: string | null;
  public readonly severity: NotificationSeverity;
  public readonly open: CommandRun | null;
  public readonly actions: readonly NotificationAction[];
  public readonly progress: number | typeof NotificationPost.indeterminate | null;

  public constructor(
    kind: QualifiedName,
    key: string | null,
    title: string,
    text: string | null,
    severity: NotificationSeverity,
    open: CommandRun | null,
    actions: readonly NotificationAction[],
    progress: number | typeof NotificationPost.indeterminate | null) {
    if (!Object.isNull(key) && String.isNullOrWhitespace(key))
      throw new ArgumentException(Resources.notificationKeyInvalid, Resources.keyField);
    if (String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.notificationTitleInvalid, Resources.titleField);
    if (!Object.isNull(text) && String.isNullOrWhitespace(text))
      throw new ArgumentException(Resources.notificationTextInvalid, Resources.textField);
    if (actions.length > NotificationPost.maximumActions)
      throw new ArgumentException(Resources.formatNotificationActionsTooMany(NotificationPost.maximumActions), Resources.actionsField);
    if (Object.isNumber(progress) && !(progress >= 0 && progress <= 1))
      throw new ArgumentException(Resources.notificationProgressInvalid, Resources.progressField);

    this.kind = kind;
    this.key = key;
    this.title = title;
    this.text = text;
    this.severity = severity;
    this.open = open;
    this.actions = [...actions];
    this.progress = progress;
  }

  public static fromJson(value: unknown, path?: string): NotificationPost {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationPost.FIELDS);
    return WireContract.create(reader, () => {
      const open = reader.hasField(Resources.openField) ? reader.readObject(Resources.openField) : null;
      return new NotificationPost(
        QualifiedName.parse(reader.readString(Resources.kindField), Resources.kindField),
        reader.hasField(Resources.keyField) ? reader.readString(Resources.keyField) : null,
        reader.readString(Resources.titleField),
        reader.hasField(Resources.textField) ? reader.readString(Resources.textField) : null,
        reader.readOneOf(Resources.severityField, NotificationPost.SEVERITIES),
        Object.isNull(open) ? null : CommandRun.fromJson(open.toJson(), open.path),
        reader.readObjectArray(Resources.actionsField).map(t => NotificationAction.fromJson(t.toJson(), t.path)),
        NotificationPost.readProgress(reader));
    });
  }

  private static readProgress(reader: JsonReader): number | typeof NotificationPost.indeterminate | null {
    if (!reader.hasField(Resources.progressField))
      return null;
    return Object.isString(reader.readValue(Resources.progressField))
      ? reader.readOneOf(Resources.progressField, [NotificationPost.indeterminate])
      : reader.readNumber(Resources.progressField);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind.text,
      ...Object.isNull(this.key) ? {} : { [Resources.keyField]: this.key },
      [Resources.titleField]: this.title,
      ...Object.isNull(this.text) ? {} : { [Resources.textField]: this.text },
      [Resources.severityField]: this.severity,
      ...Object.isNull(this.open) ? {} : { [Resources.openField]: this.open.toJson() },
      [Resources.actionsField]: this.actions.map(t => t.toJson()),
      ...Object.isNull(this.progress) ? {} : { [Resources.progressField]: this.progress }
    };
  }
}
