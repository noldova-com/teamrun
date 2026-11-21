/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { OrganizationCardField } from "../../../src/app/enums/organization-card-field";
import { OrganizationViewMode } from "../../../src/app/enums/organization-view-mode";
import { OrganizationLayout } from "../../../src/app/models/organization-layout";

describe("OrganizationLayout", () => {
  const fields = (set: ReadonlySet<OrganizationCardField>): OrganizationCardField[] => [...set].sort();

  it("shows status and what a teammate is doing now on every card by default, with no department collapsed and no card's own choice", () => {
    const layout = new OrganizationLayout();

    expect([layout.collapsedDepartments, fields(layout.cardsShow), layout.cards.size, fields(layout.fieldsOf("t1")), layout.hasOwnFields("t1"), layout.view, layout.focus])
      .toEqual([[], [OrganizationCardField.Now, OrganizationCardField.Status], 0, [OrganizationCardField.Now, OrganizationCardField.Status], false, OrganizationViewMode.Tree, null]);
  });

  it("round-trips through JSON, and reads what is missing or malformed as the defaults or nothing", () => {
    const layout = new OrganizationLayout(["d1", "d1", " ", "d2"], new Set([OrganizationCardField.Usage]),
      new Map<string, ReadonlySet<OrganizationCardField>>([["t1", new Set([OrganizationCardField.Model])], [" ", new Set([OrganizationCardField.Last])]]),
      OrganizationViewMode.Board, "t1");
    const read = OrganizationLayout.fromJson(layout.toJson());
    const odd = OrganizationLayout.fromJson({ collapsedDepartments: ["d1", 3], cardsShow: { Usage: true, Status: false, Ghost: true, Last: "yes" }, cards: { t2: [1], t3: { Now: true } },
      view: "Ghost", focus: 3 });

    expect(layout.toJson()).toEqual({
      collapsedDepartments: ["d1", "d2"],
      cardsShow: { Status: false, Now: false, Usage: true, Last: false, Model: false },
      cards: { t1: { Status: false, Now: false, Usage: false, Last: false, Model: true } },
      view: "Board",
      focus: "t1"
    });
    expect([read.collapsedDepartments, fields(read.cardsShow), fields(read.fieldsOf("t1")), read.view, read.focus])
      .toEqual([["d1", "d2"], [OrganizationCardField.Usage], [OrganizationCardField.Model], OrganizationViewMode.Board, "t1"]);
    expect([odd.collapsedDepartments, fields(odd.cardsShow), fields(odd.fieldsOf("t2")), fields(odd.fieldsOf("t3")), odd.view, odd.focus])
      .toEqual([["d1"], [OrganizationCardField.Usage], [], [OrganizationCardField.Now], OrganizationViewMode.Tree, null]);
    for (const value of [null, [], "x", { cards: "x" }])
      expect(OrganizationLayout.fromJson(value).toJson()).toEqual(new OrganizationLayout().toJson());
  });

  it("collapses and opens a department", () => {
    const collapsed = new OrganizationLayout().toggleDepartment("d1").toggleDepartment("d2");

    expect([collapsed.isCollapsed("d1"), collapsed.toggleDepartment("d1").collapsedDepartments]).toEqual([true, ["d2"]]);
  });

  it("lets a card's own choice win over what every card shows, until it is cleared, one card or every card", () => {
    const layout = new OrganizationLayout().withCardField("t1", OrganizationCardField.Usage, true).withCardField("t1", OrganizationCardField.Now, false)
      .withCardField("t2", OrganizationCardField.Last, true).withCardsShow(OrganizationCardField.Model, true).withCardsShow(OrganizationCardField.Status, false);

    expect([fields(layout.fieldsOf("t1")), fields(layout.fieldsOf("t3")), layout.hasOwnFields("t1")])
      .toEqual([[OrganizationCardField.Status, OrganizationCardField.Usage], [OrganizationCardField.Model, OrganizationCardField.Now], true]);
    expect([fields(layout.withoutCardFields("t1").fieldsOf("t1")), [...layout.withoutCardFields("t1").cards.keys()], layout.withoutAnyCardFields().cards.size])
      .toEqual([[OrganizationCardField.Model, OrganizationCardField.Now], ["t2"], 0]);
  });

  it("keeps the view and what Focus shows through every other change, and reads a blank focus as none", () => {
    const layout = new OrganizationLayout().withView(OrganizationViewMode.Focus).withFocus("d1");
    const changed = [layout.toggleDepartment("d1"), layout.withCardsShow(OrganizationCardField.Usage, true), layout.withCardField("t1", OrganizationCardField.Usage, true),
      layout.withoutCardFields("t1"), layout.withoutAnyCardFields()];

    expect(changed.map(t => [t.view, t.focus])).toEqual(Array(5).fill([OrganizationViewMode.Focus, "d1"]));
    expect([layout.withView(OrganizationViewMode.Board).focus, layout.withFocus(" ").focus, layout.withFocus(null).view]).toEqual(["d1", null, OrganizationViewMode.Focus]);
  });
});
