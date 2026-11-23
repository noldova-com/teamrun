/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Harness, Teammate } from "@noldova/teamrun.protocol";
import { AvatarComponent, AvatarSize } from "@noldova/ui.components.angular";

import { TeammateAvatarComponent } from "../../../../src/app/components/teammate-avatar/teammate-avatar.component";
import { TeammateColor } from "../../../../src/app/models/teammate-color";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammateAvatarComponent", () => {
  const reviewer = new Teammate("reviewer", "Code Reviewer", null, "a1", Harness.Provider, null, null, "t", "t");
  let fixture: ComponentFixture<TeammateAvatarComponent>;

  const avatar = (): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector("nol-avatar") as HTMLElement;
  const fill = (): string => avatar().style.getPropertyValue("--nol-avatar-fill");
  const render = async (teammate: Teammate | null): Promise<void> => {
    TestBed.configureTestingModule({ imports: [TeammateAvatarComponent] });
    fixture = TestBed.createComponent(TeammateAvatarComponent);
    fixture.componentRef.setInput("teammate", teammate);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  };
  const show = async (teammate: Teammate | null): Promise<void> => {
    fixture.componentRef.setInput("teammate", teammate);
    await fixture.whenStable();
  };
  const paint = (color: number | null): string => {
    const kit = TestBed.createComponent(AvatarComponent);
    kit.componentRef.setInput("name", "Alice");
    kit.componentRef.setInput("color", color);
    kit.detectChanges();
    return (kit.nativeElement as HTMLElement).style.getPropertyValue("--nol-avatar-fill");
  };

  it("draws a teammate small, with its name's initials and the colour its id gives, under any name", async () => {
    await render(reviewer);
    const drawn = [avatar().textContent?.trim(), avatar().getAttribute("aria-label"), avatar().classList.contains("nol-avatar-small"), fill()];
    await show(new Teammate("reviewer", "Release Owner", null, "a1", Harness.Provider, null, null, "t", "t"));

    expect(drawn).toEqual(["CR", "Code Reviewer", true, fill()]);
    expect(avatar().textContent?.trim()).toBe("RO");
    expect(getComputedStyle(fixture.nativeElement as HTMLElement).display).toBe("contents");
  });

  it("draws the default teammate when it has none, with the default letter and colour", async () => {
    await render(reviewer);
    const teammateFill = fill();
    await show(null);

    expect([avatar().textContent?.trim(), avatar().getAttribute("aria-label")]).toEqual([Resources.defaultTeammateLabel[0], Resources.defaultTeammateLabel]);
    expect(fill()).not.toBe(teammateFill);
  });

  it("colours a teammate as the store does, by when the team's teammates were made, and one outside the team, or with no store, by its id", async () => {
    const context = SampleData.createContext();
    const data = new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    const store = TestBed.inject(ChatStoreService);
    await Wait.until(() => expect(store.teammates()).toHaveLength(3));
    fixture = TestBed.createComponent(TeammateAvatarComponent);
    fixture.componentRef.setInput("teammate", data.alice);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const fills = [fill()];
    for (const teammate of [data.bob, data.unavailable, reviewer]) {
      await show(teammate);
      fills.push(fill());
    }
    ChatStoreService.release(context);

    expect(fills).toEqual([paint(2), paint(3), paint(4), paint(TeammateColor.of("reviewer"))]);
    expect([2, 3, 4].map(t => paint(t))).not.toEqual(["alice", "bob", "offline"].map(t => paint(TeammateColor.of(t))));
  });

  it("passes on its size, its unavailability and that it is decorative", async () => {
    await render(reviewer);
    fixture.componentRef.setInput("size", AvatarSize.Normal);
    fixture.componentRef.setInput("unavailable", true);
    fixture.componentRef.setInput("decorative", true);
    await fixture.whenStable();

    expect([avatar().classList.contains("nol-avatar-small"), avatar().classList.contains("nol-avatar-unavailable"), avatar().getAttribute("aria-hidden"),
      avatar().getAttribute("aria-label")]).toEqual([false, true, "true", null]);
  });
});
