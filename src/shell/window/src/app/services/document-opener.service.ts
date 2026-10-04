/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources";
import { DocumentTab } from "../models/layout/document-tab";
import { LayoutService } from "./layout.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class DocumentOpenerService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);

  public open(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    this.layout.openDocument(this.titled(moduleId, name, instance, title), isPreview);
  }

  public restore(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    this.layout.restoreDocument(this.titled(moduleId, name, instance, title), isPreview);
  }

  public restoreSaved(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    const tab = this.titled(moduleId, name, instance, title);
    if (this.layout.layout().isOpen(tab))
      this.layout.restoreDocument(tab, isPreview);
  }

  public keep(moduleId: string, name: string, instance: string): void {
    this.requireOwnDocument(moduleId, name);
    this.layout.keep(new DocumentTab(name, instance));
  }

  private titled(moduleId: string, name: string, instance: string, title: string): DocumentTab {
    this.requireOwnDocument(moduleId, name);
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    const tab = new DocumentTab(name, instance);
    this.labels.setTitle(tab, title);
    return tab;
  }

  private requireOwnDocument(moduleId: string, name: string): void {
    if (!name.startsWith(`${moduleId}${Resources.contributionSeparator}`))
      throw new ArgumentException(Resources.formatForeignDocument(moduleId, name), "name");
    if (!this.layout.registry().hasDocument(name))
      throw new ArgumentException(Resources.formatUnregisteredDocument(name), "name");
  }
}
