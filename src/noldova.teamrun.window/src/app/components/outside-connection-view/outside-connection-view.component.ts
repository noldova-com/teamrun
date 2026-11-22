/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, computed, inject, signal, type Signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { OutsideConnection } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  ClipboardWriter,
  ConfigurationTableActionDirective,
  ConfigurationTableComponent,
  ConfigurationTableDirective,
  ConfigurationTableFillDirective,
  ConfigurationTableRowActionsDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { CopiedMoment } from "../../models/copied-moment";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";

@Component({
  selector: "nol-teamrun-outside-connection-view",
  imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective, ConfigurationTableRowActionsDirective],
  providers: [ChatStoreService.provider],
  templateUrl: "./outside-connection-view.component.html",
  styleUrls: ["../settings-view.css", "../failure-row.css", "./outside-connection-view.component.css"]
})
export class OutsideConnectionViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly connection: WritableSignal<OutsideConnection | null> = signal(null);
  protected readonly shown: WritableSignal<boolean> = signal(false);
  protected readonly copied: CopiedMoment<string> = new CopiedMoment<string>(inject(ClockService));
  protected readonly resetting: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly clipboard: ClipboardWriter | null = inject(ClipboardWriter, { optional: true });
  protected readonly setups: Signal<readonly { readonly title: string; readonly text: string }[]> = computed(() => {
    const url = this.connection()?.url ?? null;
    return Object.isNull(url) ? [] : [{ title: Resources.outsideCodexSetup, text: Resources.formatCodexSetup(url) },
      { title: Resources.outsideClaudeSetup, text: Resources.formatClaudeSetup(url) }];
  });
  private readonly store: ChatStoreService = inject(ChatStoreService);

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.copied.dispose());
    void this.read();
  }

  protected stateOf(connection: OutsideConnection): string {
    return !connection.enabled ? Resources.outsideOff : connection.failure ?? Resources.outsideOn;
  }

  protected async copy(writer: ClipboardWriter, key: string, value: string): Promise<void> {
    if (await writer.writeTextAsync(value)) {
      this.copied.show(key);
      return;
    }
    this.error.set(Resources.copyFailed);
  }

  protected async reset(): Promise<void> {
    this.resetting.set(true);
    try {
      this.connection.set(await this.store.resetOutsideToken());
      this.shown.set(false);
      this.copied.clear();
    }
    catch (error) {
      this.fail(error);
    }
    finally {
      this.resetting.set(false);
    }
  }

  private fail(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : String(error));
  }

  private async read(): Promise<void> {
    try {
      this.connection.set(await this.store.readOutsideConnection());
    }
    catch (error) {
      this.fail(error);
    }
  }
}
