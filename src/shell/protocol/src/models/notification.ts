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
import { WireContract } from "../services/wire-contract.js";
import { NotificationPost } from "./notification-post.js";

export class Notification {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.sequenceField, Resources.postField, Resources.postedAtField, Resources.isReadField];

  public readonly id: string;
  public readonly sequence: number;
  public readonly post: NotificationPost;
  public readonly postedAt: string;
  public readonly isRead: boolean;

  public constructor(id: string, sequence: number, post: NotificationPost, postedAt: string, isRead: boolean) {
    if (String.isNullOrWhitespace(id))
      throw new ArgumentException(Resources.notificationIdInvalid, Resources.idField);
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      throw new ArgumentException(Resources.notificationSequenceInvalid, Resources.sequenceField);
    if (Number.isNaN(Date.parse(postedAt)))
      throw new ArgumentException(Resources.notificationTimeInvalid, Resources.postedAtField);

    this.id = id;
    this.sequence = sequence;
    this.post = post;
    this.postedAt = postedAt;
    this.isRead = isRead;
  }

  public static fromJson(value: unknown, path?: string): Notification {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, Notification.FIELDS);
    return WireContract.create(reader, () => {
      const id = reader.readString(Resources.idField);
      const sequence = reader.readInteger(Resources.sequenceField);
      const post = reader.readObject(Resources.postField);
      return new Notification(
        id,
        sequence,
        NotificationPost.fromJson(post.toJson(), post.path),
        reader.readString(Resources.postedAtField),
        reader.readBoolean(Resources.isReadField));
    });
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.sequenceField]: this.sequence,
      [Resources.postField]: this.post.toJson(),
      [Resources.postedAtField]: this.postedAt,
      [Resources.isReadField]: this.isRead
    };
  }
}
