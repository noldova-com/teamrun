/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";
import { GallerySize } from "../../enums/gallery-size";
import { VirtualListKind } from "../../enums/virtual-list-kind";
import { ButtonComponent } from "../button/button.component";
import { CodeBlockComponent } from "../code-block/code-block.component";
import { VirtualListComponent } from "../virtual-list/virtual-list.component";
import { VirtualRowDirective } from "../virtual-list/virtual-row.directive";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryFeedSource } from "./gallery-feed-source";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";

@Component({
  selector: "tr-gallery-feed",
  imports: [ButtonComponent, CodeBlockComponent, GalleryCellComponent, GallerySpecimenComponent, VirtualListComponent, VirtualRowDirective],
  templateUrl: "./gallery-feed.component.html",
  styleUrl: "./gallery-feed.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryFeedComponent {
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly timers: Set<ReturnType<typeof setInterval>> = new Set();

  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly sizes: typeof GallerySize = GallerySize;
  protected readonly kinds: typeof VirtualListKind = VirtualListKind;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly messages: GalleryFeedSource = new GalleryFeedSource(GalleryResources.feedLength, GalleryResources.feedHistoryDelay);

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.timers)
        clearInterval(timer);
    });
  }

  protected streamReply(): void {
    const index = this.messages.startReply();
    const { feedWords } = this.text;
    let step = 0;
    const timer = setInterval(() => {
      const reply = this.messages.extendReply(index, String(feedWords[step % feedWords.length]));
      step++;
      if (step < GalleryResources.feedReplyWords)
        return;
      clearInterval(timer);
      this.timers.delete(timer);
      void this.announcer.announce(GalleryResources.formatFeedReply(reply.heading, reply.text), GalleryResources.feedReplyPoliteness);
    }, GalleryResources.feedReplyInterval);
    this.timers.add(timer);
  }
}
