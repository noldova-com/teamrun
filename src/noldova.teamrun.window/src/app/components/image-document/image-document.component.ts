/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, type InputSignal, type Signal, computed, effect, inject, input, untracked } from "@angular/core";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import { ImageViewerData } from "../../models/image-viewer-data";
import { ChatStoreService } from "../../services/chat-store.service";
import { ImageViewerService } from "../../services/image-viewer.service";
import { ImageViewerComponent } from "../image-viewer/image-viewer.component";

@Component({
  selector: "nol-teamrun-image-document",
  imports: [ImageViewerComponent],
  providers: [ChatStoreService.provider, ImageViewerService.provider],
  templateUrl: "./image-document.component.html",
  styleUrl: "./image-document.component.css"
})
export class ImageDocumentComponent {
  protected readonly viewer: ImageViewerService = inject(ImageViewerService);
  protected readonly resources: typeof Resources = Resources;

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input<string>(String.empty);

  protected readonly data: Signal<ImageViewerData | null> = computed(() => {
    const image = this.viewer.find(this.instance());
    return Object.isNull(image) ? null : new ImageViewerData(image);
  });

  public constructor() {
    const store = inject(ChatStoreService);
    const forget = (): void => this.viewer.forgetTab(this.instance());
    const unwatch = store.onConversationDeleted(t => {
      if (this.viewer.find(this.instance())?.conversationId === t)
        forget();
    });
    inject(DestroyRef).onDestroy(unwatch);
    effect(() => {
      const conversationId = this.viewer.find(this.instance())?.conversationId ?? null;
      if (store.loaded() && !Object.isNull(conversationId))
        untracked(() => void store.confirmConversation(conversationId).then(exists => {
          if (!exists)
            forget();
        }));
    });
  }
}
