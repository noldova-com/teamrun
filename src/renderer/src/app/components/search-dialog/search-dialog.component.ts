/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";

import "@noldova/teamrun-foundation-core";
import type { ConversationSearchHit } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";

@Component({
  selector: "tr-search-dialog",
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./search-dialog.component.html"
})
export class SearchDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly query: WritableSignal<string> = signal("");
  protected readonly hits: WritableSignal<readonly ConversationSearchHit[]> = signal([]);
  protected readonly searched: Signal<boolean> = computed(() => !String.isNullOrWhitespace(this.query()));
  private readonly store: ChatStore = inject(ChatStore);
  private readonly dialog: MatDialogRef<SearchDialogComponent, ConversationSearchHit> = inject(MatDialogRef);
  private latest: number = 0;

  protected projectNameOf(hit: ConversationSearchHit): string {
    return this.store.projects().find(t => t.id === hit.projectId)?.name ?? String.empty;
  }

  protected onQuery(text: string): void {
    this.query.set(text);
    const request = ++this.latest;
    void this.store.search(text).then(hits => {
      if (request === this.latest)
        this.hits.set(hits);
    });
  }

  protected submit(event: globalThis.Event): void {
    event.preventDefault();
    const first = this.hits()[0];
    if (!Object.isUndefined(first))
      this.choose(first);
  }

  protected choose(hit: ConversationSearchHit): void {
    this.dialog.close(hit);
  }
}
