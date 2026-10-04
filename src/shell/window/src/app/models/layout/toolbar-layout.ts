/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../../resources";
import type { MenuPlace } from "../menu-place";

export class ToolbarLayout {
  public static readonly EMPTY: ToolbarLayout = new ToolbarLayout([], []);

  public readonly rows: readonly (readonly string[])[];
  public readonly hidden: readonly string[];

  public constructor(rows: readonly (readonly string[])[], hidden: readonly string[]) {
    const names = [...rows.flat(), ...hidden];
    if (rows.some(t => t.length === 0) || new Set(names).size !== names.length)
      throw new ArgumentException(Resources.invalidToolbarLayout, Resources.rowsParameter);
    for (const name of names)
      QualifiedName.parse(name, Resources.nameParameter);

    this.rows = rows.map(t => [...t]);
    this.hidden = [...hidden];
  }

  public static fromJson(json: JsonReader): ToolbarLayout {
    return new ToolbarLayout(json.readObjectArray(Resources.rowsField).map(t => t.readStringArray(Resources.toolbarsField)), json.readStringArray(Resources.hiddenField));
  }

  public get isEmpty(): boolean {
    return this.rows.length === 0 && this.hidden.length === 0;
  }

  public shownRows(places: readonly MenuPlace[]): readonly (readonly string[])[] {
    const toolbars = places.filter(t => !Object.isNull(t.toolbar));
    const known = new Set(toolbars.map(t => t.name));
    const rows = this.rows.map(t => t.filter(u => known.has(u))).filter(t => t.length > 0);
    const placed = new Set(rows.flat());
    const pending = toolbars.filter(t => !placed.has(t.name) && !this.hidden.includes(t.name) && t.toolbar?.isShown === true);
    const shown = new Set([...placed, ...pending.map(t => t.name)]);
    let waiting = pending;
    while (waiting.length > 0) {
      const ready = waiting.filter(t => !ToolbarLayout.isWaiting(t, shown, placed));
      const next = ready.length > 0 ? ready.slice(0, 1) : waiting.slice(0, 1);
      for (const place of next) {
        ToolbarLayout.insert(rows, place);
        placed.add(place.name);
      }
      waiting = waiting.filter(t => !next.includes(t));
    }
    return rows;
  }

  public show(name: string, places: readonly MenuPlace[]): ToolbarLayout {
    const place = places.find(t => t.name === name);
    const rows = this.shownRows(places).map(t => [...t]);
    if (Object.isUndefined(place) || Object.isNull(place.toolbar) || rows.flat().includes(name))
      return this;
    ToolbarLayout.insert(rows, place);
    return this.keeping(rows, this.hidden.filter(t => t !== name), places);
  }

  public hide(name: string, places: readonly MenuPlace[]): ToolbarLayout {
    const rows = this.shownRows(places).map(t => t.filter(u => u !== name)).filter(t => t.length > 0);
    return this.keeping(rows, [...this.hidden.filter(t => t !== name), name], places);
  }

  public move(name: string, row: number, index: number, places: readonly MenuPlace[]): ToolbarLayout {
    return this.rearrange(name, places, rows => rows[row]?.splice(index, 0, name));
  }

  public moveToNewRow(name: string, row: number, places: readonly MenuPlace[]): ToolbarLayout {
    return this.rearrange(name, places, rows => rows.splice(row, 0, [name]));
  }

  public toJson(): JsonObject {
    return { [Resources.rowsField]: this.rows.map(t => ({ [Resources.toolbarsField]: [...t] })), [Resources.hiddenField]: [...this.hidden] };
  }

  private rearrange(name: string, places: readonly MenuPlace[], insert: (rows: string[][]) => unknown): ToolbarLayout {
    const rows = this.shownRows(places).map(t => t.filter(u => u !== name));
    insert(rows);
    if (!rows.flat().includes(name))
      return this;
    return this.keeping(rows, this.hidden.filter(t => t !== name), places);
  }

  private keeping(shown: readonly (readonly string[])[], hidden: readonly string[], places: readonly MenuPlace[]): ToolbarLayout {
    const known = new Set(places.filter(t => !Object.isNull(t.toolbar)).map(t => t.name));
    const rows = shown.map(t => [...t]).filter(t => t.length > 0);
    const present = new Set(rows.flat());
    this.rows.forEach((stored, index) => stored.forEach((name, position) => {
      if (known.has(name))
        return;
      const before = stored.slice(0, position).reverse().find(t => present.has(t));
      const after = stored.slice(position + 1).find(t => present.has(t));
      const anchor = before ?? after;
      const row = Object.isUndefined(anchor) ? undefined : rows.find(t => t.includes(anchor));
      if (Object.isUndefined(anchor) || Object.isUndefined(row))
        rows.splice(Math.min(index, rows.length), 0, [name]);
      else
        row.splice(row.indexOf(anchor) + (Object.isUndefined(before) ? 0 : 1), 0, name);
      present.add(name);
    }));
    return new ToolbarLayout(rows, hidden);
  }

  private static isWaiting(place: MenuPlace, shown: ReadonlySet<string>, placed: ReadonlySet<string>): boolean {
    const anchor = place.toolbar?.after ?? place.toolbar?.before ?? null;
    return !Object.isNull(anchor) && shown.has(anchor) && !placed.has(anchor);
  }

  private static insert(rows: string[][], place: MenuPlace): void {
    const after = place.toolbar?.after ?? null;
    const anchor = after ?? place.toolbar?.before ?? null;
    const row = Object.isNull(anchor) ? undefined : rows.find(t => t.includes(anchor));
    if (!Object.isNull(anchor) && !Object.isUndefined(row)) {
      row.splice(row.indexOf(anchor) + (Object.isNull(after) ? 0 : 1), 0, place.name);
      return;
    }
    const last = rows.at(-1);
    if (place.toolbar?.startsRow === true || Object.isUndefined(last))
      rows.push([place.name]);
    else
      last.push(place.name);
  }
}
