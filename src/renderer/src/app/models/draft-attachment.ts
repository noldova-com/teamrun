/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";

export class DraftAttachment {
  public readonly id: string;
  public readonly file: File | null;
  public readonly saved: MessageAttachment | null;

  public constructor(id: string, file: File | null, saved: MessageAttachment | null) {
    if (String.isNullOrWhitespace(id) || Object.isNull(file) === Object.isNull(saved))
      throw new Error(Resources.draftUnreadable);
    const size = file?.size ?? saved?.size ?? 0;
    const mediaType = file?.type ?? saved?.mediaType ?? String.empty;
    if (size > ProtocolResources.maximumAttachmentBytes
      || (ProtocolResources.attachmentImageMediaTypes.includes(mediaType) && size > ProtocolResources.maximumAttachmentImageBytes))
      throw new Error(Resources.attachmentLimitExceeded);

    this.id = id;
    this.file = file;
    this.saved = saved;
  }

  public static fromStored(value: unknown): DraftAttachment {
    if (!Object.isObject(value) || !("id" in value) || !("file" in value) || !("saved" in value)
      || !Object.isString(value.id) || !(Object.isNull(value.file) || value.file instanceof File))
      throw new Error(Resources.draftUnreadable);
    return new DraftAttachment(value.id, value.file, Object.isNull(value.saved) ? null : MessageAttachment.fromJson(value.saved));
  }
}
