/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type WritableSignal, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { DocumentHeading } from "../models/document-heading";
import type { Tab } from "../models/layout/tab";
import { TabLabel } from "../models/layout/tab-label";
import type { ViewBadge } from "../models/view-badge";

@Injectable({ providedIn: "root" })
export class TabLabelService {
  private readonly labels: WritableSignal<ReadonlyMap<string, TabLabel>> = signal(new Map());
  private readonly titles: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly breadcrumbs: WritableSignal<ReadonlyMap<string, readonly string[]>> = signal(new Map());
  private readonly badges: WritableSignal<ReadonlyMap<string, ViewBadge>> = signal(new Map());
  private readonly working: WritableSignal<ReadonlySet<string>> = signal(new Set());

  public register(name: string, label: TabLabel): void {
    this.labels.update(t => new Map([...t, [name, label]]));
  }

  public setBadge(view: string, badge: ViewBadge | null): void {
    this.badges.update(t => new Map([...t].filter(([name]) => name !== view).concat(Object.isNull(badge) ? [] : [[view, badge]])));
  }

  public badgeOf(tab: Tab): ViewBadge | null {
    return tab.isMovable ? this.badges().get(tab.name) ?? null : null;
  }

  public setWorking(tabKey: string, isWorking: boolean): void {
    this.working.update(t => new Set([...t].filter(u => u !== tabKey).concat(isWorking ? [tabKey] : [])));
  }

  public isWorking(tab: Tab): boolean {
    return this.working().has(tab.key);
  }

  public setTitle(tab: Tab, title: string): void {
    this.titles.update(t => new Map([...t, [tab.key, title]]));
  }

  public setHeading(tab: Tab, heading: DocumentHeading): void {
    this.setTitle(tab, heading.title);
    this.breadcrumbs.update(t => new Map([...t, [tab.key, heading.breadcrumb]]));
  }

  public headingOf(tab: Tab): DocumentHeading {
    return new DocumentHeading(this.of(tab).title, this.breadcrumbs().get(tab.key) ?? []);
  }

  public of(tab: Tab): TabLabel {
    const label = this.labels().get(tab.name);
    const title = this.titles().get(tab.key);
    if (!Object.isUndefined(title))
      return new TabLabel(title, label?.icon ?? (tab.isMovable ? Resources.viewGlyph : Resources.documentGlyph));
    if (!Object.isUndefined(label))
      return Object.isUndefined(tab.instance) ? label : new TabLabel(`${label.title} ${tab.instance}`, label.icon);
    return new TabLabel(tab.instance ?? tab.name, tab.isMovable ? Resources.viewGlyph : Resources.documentGlyph);
  }
}
