/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Injectable, type Signal, type WritableSignal, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";
import { DialogService } from "@noldova/teamrun-shell-ui";

import { ViewDialogComponent } from "../components/view-dialog/view-dialog.component";
import { ViewDialogException } from "../exceptions/view-dialog.exception";
import { DocumentTab } from "../models/layout/document-tab";
import type { Tab } from "../models/layout/tab";
import type { TabReveal } from "../models/layout/tab-reveal";
import { Resources } from "../../resources";
import { LayoutService } from "./layout.service";
import { TabFocusService } from "./tab-focus.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class ViewDialogService {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly shownValue: WritableSignal<Tab | null> = signal(null);
  private dialog: DialogRef<unknown, ViewDialogComponent> | null = null;
  private wasOpen: boolean = false;
  private shownAfter: number = 0;
  private revealedDocument: Tab | null = null;

  public readonly shown: Signal<Tab | null> = this.shownValue.asReadonly();

  public constructor() {
    effect(() => {
      const tab = this.shownValue();
      if (!Object.isNull(tab) && !this.isShowable(tab))
        untracked(() => this.close());
    });
    effect(() => {
      const reveal = this.layout.revealed();
      if (!Object.isNull(reveal))
        untracked(() => this.leaveFor(reveal));
    });
  }

  public canShow(tab: Tab): boolean {
    return !this.dialogs.isOpen && tab.isAvailable(this.layout.registry());
  }

  public showAsync(tab: Tab, title: string | null = null): Promise<void> {
    if (this.dialogs.isOpen)
      return Promise.reject(new ViewDialogException(Resources.dialogAlreadyOpen));
    if (!tab.isAvailable(this.layout.registry()))
      return Promise.reject(new ArgumentException(tab instanceof DocumentTab ? Resources.formatUnregisteredDocument(tab.name) : Resources.formatUnregisteredView(tab.name), "tab"));
    if (!Object.isNull(title))
      this.labels.setTitle(tab, title);
    this.wasOpen = this.layout.layout().isOpen(tab);
    this.shownAfter = this.layout.revealed()?.sequence ?? 0;
    this.shownValue.set(tab);
    const dialog = this.dialogs.open(ViewDialogComponent);
    this.dialog = dialog;
    return new Promise(resolve => dialog.closed.subscribe(() => {
      this.dialog = null;
      this.shownValue.set(null);
      const revealed = this.revealedDocument;
      this.revealedDocument = null;
      if (Object.isNull(revealed))
        this.tabFocus.focusIfLost(tab);
      else
        this.tabFocus.focus(revealed);
      resolve();
    }));
  }

  public ownsCommand(name: string): boolean {
    const tab = this.shownValue();
    if (Object.isNull(tab) || Object.isNull(this.dialog) || !this.dialogs.isTopmost(this.dialog))
      return false;
    const owner = QualifiedName.parse(tab.name);
    return !owner.isShell && owner.owner === QualifiedName.parse(name).owner;
  }

  public close(): void {
    this.dialog?.close();
  }

  private leaveFor(reveal: TabReveal): void {
    if (Object.isNull(this.dialog) || reveal.sequence <= this.shownAfter || !(reveal.tab instanceof DocumentTab) || reveal.tab.equals(this.shownValue())
      || !this.layout.layout().isOpen(reveal.tab))
      return;
    this.revealedDocument = reveal.tab;
    this.close();
  }

  private isShowable(tab: Tab): boolean {
    return tab.isAvailable(this.layout.registry()) && (!this.wasOpen || this.layout.layout().isOpen(tab));
  }
}
