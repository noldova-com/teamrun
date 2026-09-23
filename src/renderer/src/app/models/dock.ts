/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { PanelId } from "../enums/panel-id";
import { Resources } from "../resources";

export class Dock {
  public readonly side: DockSide;
  public readonly panels: readonly PanelId[];
  public readonly activePanel: PanelId | null;
  public readonly size: number | null;
  public readonly collapsed: boolean;

  public constructor(side: DockSide, panels: readonly PanelId[], activePanel: PanelId | null, size: number | null, collapsed: boolean) {
    const unique = [...new Set(panels)];
    this.side = side;
    this.panels = unique;
    this.activePanel = !Object.isNull(activePanel) && unique.includes(activePanel) ? activePanel : unique[0] ?? null;
    this.size = Object.isNull(size) ? null : Dock.clamp(size);
    this.collapsed = collapsed;
  }

  public static createEmpty(side: DockSide): Dock {
    return new Dock(side, [], null, null, false);
  }

  public static fromJson(side: DockSide, value: unknown): Dock {
    if (!Object.isObject(value) || Array.isArray(value))
      return Dock.createEmpty(side);
    const record: Record<string, unknown> = { ...value };
    const listed = record[Resources.panelsField];
    const known = Object.values(PanelId);
    const panels = Array.isArray(listed) ? listed.filter((t): t is PanelId => known.some(k => k === t)) : [];
    const active = record[Resources.activePanelField];
    const size = record[Resources.sizeField];

    return new Dock(
      side,
      panels,
      known.find(t => t === active) ?? null,
      Object.isNumber(size) && Number.isFinite(size) ? size : null,
      record[Resources.collapsedField] === true);
  }

  public toJson(): Record<string, unknown> {
    return {
      [Resources.panelsField]: [...this.panels],
      [Resources.activePanelField]: this.activePanel,
      [Resources.sizeField]: this.size,
      [Resources.collapsedField]: this.collapsed
    };
  }

  public has(panel: PanelId): boolean {
    return this.panels.includes(panel);
  }

  public add(panel: PanelId, index: number = this.panels.length): Dock {
    const others = this.panels.filter(t => t !== panel);
    const at = Math.max(0, Math.min(others.length, index));
    return new Dock(this.side, [...others.slice(0, at), panel, ...others.slice(at)], panel, this.size, this.collapsed);
  }

  public remove(panel: PanelId): Dock {
    const index = this.panels.indexOf(panel);
    if (index < 0)
      return this;
    const rest = this.panels.filter(t => t !== panel);
    const active = this.activePanel === panel ? rest[Math.min(index, rest.length - 1)] ?? null : this.activePanel;
    return new Dock(this.side, rest, active, this.size, this.collapsed);
  }

  public activate(panel: PanelId): Dock {
    return this.has(panel) ? new Dock(this.side, this.panels, panel, this.size, false) : this;
  }

  public withSize(size: number | null): Dock {
    return new Dock(this.side, this.panels, this.activePanel, size, this.collapsed);
  }

  public withCollapsed(collapsed: boolean): Dock {
    return new Dock(this.side, this.panels, this.activePanel, this.size, collapsed);
  }

  private static clamp(size: number): number {
    return Math.min(Resources.dockMaximumSize, Math.max(Resources.dockMinimumSize, Math.round(size)));
  }
}
