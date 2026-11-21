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
import { OrganizationRecipient } from "./organization-recipient.js";
import { OrganizationTarget } from "./organization-target.js";

export class OrganizationMessage {
  public readonly id: string;
  public readonly target: OrganizationTarget;
  public readonly text: string;
  public readonly createdAt: string;
  public readonly recipients: readonly OrganizationRecipient[];

  public constructor(
    id: string,
    target: OrganizationTarget,
    text: string,
    createdAt: string,
    recipients: readonly OrganizationRecipient[]) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    if (new Set(recipients.map(t => t.teammateId)).size !== recipients.length)
      throw new ArgumentException(Resources.recipientTwice, Resources.recipientsField);

    this.id = id;
    this.target = target;
    this.text = text;
    this.createdAt = createdAt;
    this.recipients = [...recipients];
  }

  public static fromJson(value: unknown, path?: string): OrganizationMessage {
    const reader = JsonReader.fromValue(value, path);
    const target = reader.readObject(Resources.targetField);
    return new OrganizationMessage(
      reader.readNonBlankString(Resources.idField),
      OrganizationTarget.fromJson(target.toJson(), target.path),
      reader.readNonBlankString(Resources.textField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readObjectArray(Resources.recipientsField).map(t => OrganizationRecipient.fromJson(t.toJson(), t.path)));
  }

  public withRecipient(recipient: OrganizationRecipient): OrganizationMessage {
    return new OrganizationMessage(this.id, this.target, this.text, this.createdAt,
      this.recipients.map(t => t.teammateId === recipient.teammateId ? recipient : t));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.targetField]: this.target.toJson(),
      [Resources.textField]: this.text,
      [Resources.createdAtField]: this.createdAt,
      [Resources.recipientsField]: this.recipients.map(t => t.toJson())
    };
  }
}
