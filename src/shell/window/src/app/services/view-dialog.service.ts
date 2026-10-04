/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { DialogService } from "@noldova/teamrun-shell-ui";

import { ViewDialogComponent } from "../components/view-dialog/view-dialog.component";
import { ViewDialogException } from "../exceptions/view-dialog.exception";
import { DocumentTab } from "../models/layout/document-tab";
import type { Tab } from "../models/layout/tab";
import { Resources } from "../../resources";
import { LayoutService } from "./layout.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class ViewDialogService {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly shownValue: WritableSignal<Tab | null> = signal(null);
  private dialog: DialogRef<unknown, ViewDialogComponent> | null = null;

  public readonly shown: Signal<Tab | null> = this.shownValue.asReadonly();

  public canShow(tab: Tab): boolean {
    return Object.isNull(this.dialog) && tab.isAvailable(this.layout.registry());
  }

  public showAsync(tab: Tab, title: string | null = null): Promise<void> {
    if (!Object.isNull(this.dialog))
      return Promise.reject(new ViewDialogException(Resources.viewDialogShown));
    if (!tab.isAvailable(this.layout.registry()))
      return Promise.reject(new ArgumentException(tab instanceof DocumentTab ? Resources.formatUnregisteredDocument(tab.name) : Resources.formatUnregisteredView(tab.name), "tab"));
    if (!Object.isNull(title))
      this.labels.setTitle(tab, title);
    this.shownValue.set(tab);
    const dialog = this.dialogs.open(ViewDialogComponent, Resources.dialogCloseSelector);
    this.dialog = dialog;
    return new Promise(resolve => dialog.closed.subscribe(() => {
      this.dialog = null;
      this.shownValue.set(null);
      resolve();
    }));
  }

  public close(): void {
    this.dialog?.close();
  }
}
