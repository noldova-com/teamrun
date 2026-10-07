/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { VirtualListSource } from "../../models/virtual-list-source";
import { GalleryMessage } from "./gallery-message";
import { GalleryResources } from "./gallery-resources";

export class GalleryFeedSource extends VirtualListSource<GalleryMessage> {
  private readonly delay: number;
  private readonly replies: Map<number, GalleryMessage> = new Map();

  public constructor(length: number, delay: number) {
    super(length);
    this.delay = delay;
  }

  public readAsync(start: number, end: number): Promise<readonly GalleryMessage[]> {
    const messages = Array.from({ length: end - start }, (_, t) => this.messageAt(start + t));
    if (start >= this.length() - GalleryResources.feedRecent)
      return Promise.resolve(messages);
    return new Promise(t => setTimeout(() => t(messages), this.delay));
  }

  public keyOf(item: GalleryMessage): string {
    return item.key;
  }

  public startReply(): number {
    const index = this.length();
    this.replies.set(index, new GalleryMessage(String(index), GalleryResources.formatFeedHeading(GalleryResources.text.feedReplyAuthor, index), String.empty, null));
    this.reportInserted(index, 1);
    return index;
  }

  public extendReply(index: number, word: string): void {
    const reply = this.messageAt(index);
    this.replies.set(index, reply.withText(reply.text === String.empty ? word : `${reply.text} ${word}`));
    this.reportUpdated(index, 1);
  }

  private static generate(index: number): GalleryMessage {
    const { feedAuthors, feedWords } = GalleryResources.text;
    const author = String(feedAuthors[index % feedAuthors.length]);
    const count = 4 + index * 7 % 40;
    const text = Array.from({ length: count }, (_, t) => feedWords[(index + t) % feedWords.length]).join(" ");
    const code = index % GalleryResources.feedCodeEvery === 4 ? GalleryResources.formatFeedCode(index) : null;
    return new GalleryMessage(String(index), GalleryResources.formatFeedHeading(author, index), text, code);
  }

  private messageAt(index: number): GalleryMessage {
    return this.replies.get(index) ?? GalleryFeedSource.generate(index);
  }
}
