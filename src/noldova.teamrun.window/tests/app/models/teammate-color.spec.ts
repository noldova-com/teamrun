/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Harness, Teammate } from "@noldova/teamrun.protocol";
import { AvatarComponent } from "@noldova/ui.components.angular";

import { TeammateColor } from "../../../src/app/models/teammate-color";

describe("TeammateColor", () => {
  const paint = (inputs: Record<string, unknown>): string => {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput("name", "Alice");
    for (const [name, value] of Object.entries(inputs))
      fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).style.getPropertyValue("--nol-avatar-fill");
  };

  it("gives a teammate the author colour the kit's avatar gives its id", () => {
    for (const id of ["t1", "t2", "t3", "alice", "bob", "carol", "019a1f2e-7c4d-7b21-9f3e-2a6c5d8e1b40"])
      expect(paint({ color: TeammateColor.of(id) })).toBe(paint({ colorKey: id }));
  });

  it("gives different teammates different colours, and no teammate the kit's default fill", () => {
    expect([TeammateColor.of("t1"), TeammateColor.of("t2"), TeammateColor.of("t3")]).toEqual([7, 4, 1]);
    expect(TeammateColor.of(null)).toBeNull();
    expect(paint({ color: TeammateColor.of(null) })).toBe(paint({}));
    expect(paint({ color: TeammateColor.of(null) })).not.toBe(paint({ color: TeammateColor.of("t1") }));
  });

  it("colours the team by creation, the first made first and a tie by id, never in the Default's colour, starting over after the seventh, and keeps the id colour for one outside the team", () => {
    const made = (id: string, createdAt: string): Teammate => new Teammate(id, id, null, "a1", Harness.Provider, null, null, createdAt, createdAt);
    const team = [made("k", "2026-01-09"), made("b", "2026-01-01"), made("a", "2026-01-01"), ...["c", "d", "e", "f", "g", "h", "i"].map((t, index) => made(t, `2026-01-0${index + 2}`))];
    const colors = TeammateColor.byCreation(team);

    expect([...colors]).toEqual([["a", 2], ["b", 3], ["c", 4], ["d", 5], ["e", 6], ["f", 7], ["g", 8], ["h", 2], ["i", 3], ["k", 4]]);
    expect([TeammateColor.of("b", colors), TeammateColor.of("t1", colors), TeammateColor.of(null, colors)]).toEqual([3, 7, null]);
  });
});
