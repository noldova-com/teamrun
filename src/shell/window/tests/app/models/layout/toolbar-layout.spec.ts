/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { ToolbarLayout } from "../../../../src/app/models/layout/toolbar-layout";
import { MenuPlace } from "../../../../src/app/models/menu-place";
import { ToolbarPlacement } from "../../../../src/app/models/toolbar-placement";

function toolbar(name: string, placement: ToolbarPlacement = new ToolbarPlacement()): MenuPlace {
  return new MenuPlace(name, name, false, null, placement);
}

const menu = new MenuPlace("shell.file", "File", true);

describe("ToolbarLayout", () => {
  it("shows the declared toolbars in order on one row, leaving out those not shown by default and places that are not toolbars", () => {
    const places = [menu, toolbar("a.one"), toolbar("a.two", new ToolbarPlacement(false)), toolbar("b.three")];

    expect(ToolbarLayout.EMPTY.shownRows(places)).toEqual([["a.one", "b.three"]]);
    expect(ToolbarLayout.EMPTY.isEmpty).toBe(true);
    expect(ToolbarLayout.EMPTY.shownRows([menu])).toEqual([]);
  });

  it("starts a new row for a toolbar that asks for one and places a toolbar after or before its anchor when the anchor is shown", () => {
    const places = [toolbar("a.one"), toolbar("a.two", new ToolbarPlacement(true, null, null, true)), toolbar("a.three", new ToolbarPlacement(true, "a.one")),
      toolbar("a.four", new ToolbarPlacement(true, null, "a.two"))];

    expect(ToolbarLayout.EMPTY.shownRows(places)).toEqual([["a.one", "a.three"], ["a.four", "a.two"]]);
  });

  it("follows a preferred position whose anchor comes later in the order, and falls back to the order when the anchor is not shown or the anchors wait on each other", () => {
    const later = [toolbar("a.one", new ToolbarPlacement(true, "a.two")), toolbar("a.two")];
    const hiddenAnchor = [toolbar("a.one"), toolbar("a.two", new ToolbarPlacement(true, "a.three")), toolbar("a.three", new ToolbarPlacement(false))];
    const cycle = [toolbar("a.one", new ToolbarPlacement(true, "a.two")), toolbar("a.two", new ToolbarPlacement(true, "a.one"))];

    expect(ToolbarLayout.EMPTY.shownRows(later)).toEqual([["a.two", "a.one"]]);
    expect(ToolbarLayout.EMPTY.shownRows(hiddenAnchor)).toEqual([["a.one", "a.two"]]);
    expect(ToolbarLayout.EMPTY.shownRows(cycle)).toEqual([["a.one", "a.two"]]);
  });

  it("keeps the saved arrangement, adds a toolbar it has not seen where its declaration says, and leaves out hidden and absent toolbars", () => {
    const places = [toolbar("a.one"), toolbar("a.two"), toolbar("a.three"), toolbar("a.four", new ToolbarPlacement(true, null, null, true))];
    const saved = new ToolbarLayout([["a.two", "gone.one"], ["a.one"]], ["a.three"]);

    expect(saved.shownRows(places)).toEqual([["a.two"], ["a.one"], ["a.four"]]);
    expect(saved.isEmpty).toBe(false);
  });

  it("shows a toolbar where its declaration places it, forgets it as hidden when asked, and changes nothing for a toolbar that is shown or unknown", () => {
    const places = [toolbar("a.one"), toolbar("a.two", new ToolbarPlacement(false, "a.one"))];
    const shown = ToolbarLayout.EMPTY.show("a.two", places);

    expect(shown.shownRows(places)).toEqual([["a.one", "a.two"]]);
    expect(shown.show("a.two", places)).toBe(shown);
    expect(shown.show("a.none", places)).toBe(shown);
    expect(ToolbarLayout.EMPTY.show("shell.file", [menu])).toBe(ToolbarLayout.EMPTY);
    const hidden = shown.hide("a.one", places);
    expect(hidden.shownRows(places)).toEqual([["a.two"]]);
    expect(hidden.hidden).toEqual(["a.one"]);
    expect(hidden.show("a.one", places).hidden).toEqual([]);
    expect(hidden.hide("a.one", places).hidden).toEqual(["a.one"]);
  });

  it("moves a toolbar within its row, to another row and to a new row, dropping a row that empties", () => {
    const places = [toolbar("a.one"), toolbar("a.two"), toolbar("a.three", new ToolbarPlacement(true, null, null, true))];
    const start = ToolbarLayout.EMPTY.hide("a.none", places);

    expect(ToolbarLayout.EMPTY.move("a.one", 0, 1, places).rows).toEqual([["a.two", "a.one"], ["a.three"]]);
    expect(ToolbarLayout.EMPTY.move("a.one", 1, 0, places).rows).toEqual([["a.two"], ["a.one", "a.three"]]);
    expect(ToolbarLayout.EMPTY.move("a.three", 0, 0, places).rows).toEqual([["a.three", "a.one", "a.two"]]);
    expect(ToolbarLayout.EMPTY.moveToNewRow("a.one", 2, places).rows).toEqual([["a.two"], ["a.three"], ["a.one"]]);
    expect(ToolbarLayout.EMPTY.moveToNewRow("a.one", 0, places).rows).toEqual([["a.one"], ["a.two"], ["a.three"]]);
    expect(ToolbarLayout.EMPTY.move("a.one", 5, 0, places)).toBe(ToolbarLayout.EMPTY);
    expect(start.hidden).toEqual(["a.none"]);
  });

  it("keeps the saved place of an absent module's toolbars through every change, so they return where they stood", () => {
    const places = [toolbar("a.one"), toolbar("a.two"), toolbar("a.three")];
    const withAbsent = [...places, toolbar("gone.one"), toolbar("gone.two"), toolbar("gone.three")];
    const saved = new ToolbarLayout([["gone.one", "a.one", "gone.two", "gone.three", "a.two"], ["gone.four"], ["a.three"]], []);

    expect(saved.hide("a.two", places).rows).toEqual([["gone.one", "a.one", "gone.two", "gone.three"], ["gone.four"], ["a.three"]]);
    expect(saved.hide("a.one", places).hide("a.two", places).rows).toEqual([["gone.one", "gone.two", "gone.three"], ["gone.four"], ["a.three"]]);
    expect(saved.move("a.three", 0, 0, places).rows).toEqual([["a.three", "gone.one", "a.one", "gone.two", "gone.three", "a.two"], ["gone.four"]]);
    expect(saved.moveToNewRow("a.one", 0, places).rows).toEqual([["gone.one", "a.one", "gone.two", "gone.three"], ["gone.four"], ["a.two"], ["a.three"]]);
    expect(saved.hide("a.three", places).rows).toEqual([["gone.one", "a.one", "gone.two", "gone.three", "a.two"], ["gone.four"]]);
    expect(saved.show("a.three", places)).toBe(saved);
    expect(ToolbarLayout.EMPTY.hide("a.one", places).show("a.one", places).rows).toEqual([["a.two", "a.three", "a.one"]]);
    expect(saved.hide("a.two", places).shownRows(withAbsent)).toEqual([["gone.one", "a.one", "gone.two", "gone.three"], ["a.three"]]);
    expect(saved.hide("a.two", places).shownRows(places)).toEqual([["a.one"], ["a.three"]]);
  });

  it("moves a hidden toolbar into view", () => {
    const places = [toolbar("a.one"), toolbar("a.two")];
    const hidden = ToolbarLayout.EMPTY.hide("a.two", places);

    expect(hidden.move("a.two", 0, 0, places)).toEqual(new ToolbarLayout([["a.two", "a.one"]], []));
  });

  it("is written to JSON and read back, and refuses an empty row, a name twice and a name that is not qualified", () => {
    const layout = new ToolbarLayout([["a.one", "a.two"], ["a.three"]], ["a.four"]);

    expect(layout.toJson()).toEqual({ rows: [{ toolbars: ["a.one", "a.two"] }, { toolbars: ["a.three"] }], hidden: ["a.four"] });
    expect(ToolbarLayout.fromJson(JsonReader.fromValue(layout.toJson()))).toEqual(layout);
    expect(() => new ToolbarLayout([[]], [])).toThrowError(ArgumentException);
    expect(() => new ToolbarLayout([["a.one"]], ["a.one"])).toThrowError(ArgumentException);
    expect(() => new ToolbarLayout([["one"]], [])).toThrowError(ArgumentException);
  });
});
