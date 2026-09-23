/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Resources as ProtocolResources } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";

export class DraftManifest {
  public readonly conversationId: string;
  public readonly text: string;
  public readonly attachmentIds: readonly string[];

  public constructor(conversationId: string, text: string, attachmentIds: readonly string[]) {
    if (attachmentIds.length > ProtocolResources.maximumAttachments || new Set(attachmentIds).size !== attachmentIds.length)
      throw new Error(Resources.draftUnreadable);

    this.conversationId = conversationId;
    this.text = text;
    this.attachmentIds = [...attachmentIds];
  }

  public static fromStored(value: unknown): DraftManifest {
    const reader = JsonReader.fromValue(value);
    return new DraftManifest(reader.readNonBlankString(Resources.draftConversationField), reader.readString(Resources.draftTextField),
      reader.readStringArray(Resources.draftAttachmentIdsField));
  }

  public matches(other: DraftManifest): boolean {
    return this.text === other.text && this.attachmentIds.length === other.attachmentIds.length
      && this.attachmentIds.every((id, index) => id === other.attachmentIds[index]);
  }
}
