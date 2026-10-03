/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { NotificationPost } from "./notification-post.js";

export class NotificationUpdate {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.postField];

  public readonly id: number;
  public readonly post: NotificationPost;

  public constructor(id: number, post: NotificationPost) {
    if (!Number.isSafeInteger(id) || id < 1)
      throw new ArgumentException(Resources.notificationIdInvalid, Resources.idField);

    this.id = id;
    this.post = post;
  }

  public static fromJson(value: unknown, path?: string): NotificationUpdate {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationUpdate.FIELDS);
    return WireContract.create(reader, () => {
      const id = reader.readInteger(Resources.idField);
      const post = reader.readObject(Resources.postField);
      return new NotificationUpdate(id, NotificationPost.fromJson(post.toJson(), post.path));
    });
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.postField]: this.post.toJson() };
  }
}
