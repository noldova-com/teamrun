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
import type { Tab } from "../models/layout/tab";
import { TabLabel } from "../models/layout/tab-label";

@Injectable({ providedIn: "root" })
export class TabLabelService {
  private readonly labels: WritableSignal<ReadonlyMap<string, TabLabel>> = signal(new Map());

  public register(name: string, label: TabLabel): void {
    this.labels.update(t => new Map([...t, [name, label]]));
  }

  public of(tab: Tab): TabLabel {
    const label = this.labels().get(tab.name);
    if (!Object.isUndefined(label))
      return Object.isUndefined(tab.instance) ? label : new TabLabel(`${label.title} ${tab.instance}`, label.icon);
    return new TabLabel(tab.instance ?? tab.name, tab.isMovable ? Resources.viewGlyph : Resources.documentGlyph);
  }
}
