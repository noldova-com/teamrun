/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationCardComponent } from "../../../../src/app/components/organization-card/organization-card.component";
import { OrganizationCardField } from "../../../../src/app/enums/organization-card-field";
import { OrganizationCardShape } from "../../../../src/app/enums/organization-card-shape";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationCardComponent's shapes", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationCardComponent>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const one = (selector: string): HTMLElement => {
    const found = element().querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const avatar = (): HTMLElement => one("nol-teamrun-teammate-avatar > *");
  const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (shape: OrganizationCardShape | null): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationCardComponent);
    fixture.componentRef.setInput("teammate", data.alice);
    if (!Object.isNull(shape))
      fixture.componentRef.setInput("shape", shape);
    fixture.autoDetectChanges();
    const parent = element().parentElement;
    if (Object.isNull(parent))
      throw new Error("The card has no parent.");
    parent.style.width = "30rem";
    OrganizationLayoutService.of(context).showOnEveryCard(OrganizationCardField.Model, true);
    await Wait.until(() => expect(element().querySelector(".model")).not.toBeNull());
    await settle();
  };

  afterEach(() => {
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("is a card unless told otherwise, and takes each shape's class", async () => {
    await create(null);
    const classes = (): boolean[] => [element().classList.contains("fluid"), element().classList.contains("row")];
    const kept = classes();
    fixture.componentRef.setInput("shape", OrganizationCardShape.Fluid);
    await settle();
    const fluid = classes();
    fixture.componentRef.setInput("shape", OrganizationCardShape.Row);
    await settle();

    expect([kept, fluid, classes()]).toEqual([[false, false], [true, false], [false, true]]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sizes a card to 15rem with the fields under its head", async () => {
      await create(OrganizationCardShape.Card);
      const head = one(".head");

      AppearanceFixture.expectPixels(box(element()).width, 15 * rem());
      AppearanceFixture.expectPixels(box(avatar()).left - box(element()).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(one(".status")).top - box(head).bottom, space(2));
      AppearanceFixture.expectPixels(box(one(".status")).left, box(head).left);
    });

    it("widens a fluid card to its container, with the card's own insets", async () => {
      await create(OrganizationCardShape.Fluid);

      AppearanceFixture.expectPixels(box(element()).width, 30 * rem());
      AppearanceFixture.expectPixels(box(avatar()).left - box(element()).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(element()).right - box(one(".tune")).right, space(3) + 1);
    });

    it("lays a row out with the avatar at the left, the name and role on one line, the fields under the name, and no border", async () => {
      await create(OrganizationCardShape.Row);
      const host = box(element());
      const face = box(avatar());
      const who = box(one(".who"));
      const tune = box(one(".tune"));
      const status = box(one(".status"));
      const model = box(one(".model"));

      AppearanceFixture.expectPixels(host.width, 30 * rem());
      expect(getComputedStyle(element()).borderTopWidth).toBe("0px");
      AppearanceFixture.expectPixels(face.left - host.left, space(2));
      AppearanceFixture.expectPixels(face.top - host.top, space(2));
      AppearanceFixture.expectPixels(who.left - face.right, space(2));
      AppearanceFixture.expectPixels(tune.left - who.right, space(2));
      AppearanceFixture.expectPixels(host.right - tune.right, space(2));
      AppearanceFixture.expectPixels(tune.top - host.top, space(2));
      AppearanceFixture.expectPixels(box(one(".role")).left - box(one(".name")).right, space(2));
      AppearanceFixture.expectPixels(status.left, who.left);
      AppearanceFixture.expectPixels(status.top - Math.max(face.bottom, who.bottom, tune.bottom), space(1));
      AppearanceFixture.expectPixels(model.left, who.left);
      AppearanceFixture.expectPixels(host.bottom - model.bottom, space(2));
    });
  });
});
