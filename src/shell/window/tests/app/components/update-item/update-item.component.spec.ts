/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { UpdateItemComponent } from "../../../../src/app/components/update-item/update-item.component";
import { UpdateStateKind } from "../../../../src/app/enums/update-state-kind";
import { UpdateState } from "../../../../src/app/models/update-state";
import { UpdateService } from "../../../../src/app/services/update.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("UpdateItemComponent", () => {
  let state: WritableSignal<UpdateState>;
  let calls: string[];

  const of = (kind: UpdateStateKind, fields: Partial<{ version: string; progress: number; mustMove: boolean }> = {}): UpdateState =>
    new UpdateState(kind, fields.version ?? null, fields.progress ?? null, null, null, fields.mustMove ?? false);

  beforeEach(() => {
    state = signal(UpdateState.off);
    calls = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: UpdateService,
        useValue: { state, act: (action: string) => calls.push(action), openAbout: () => calls.push("About") }
      }]
    });
  });

  afterEach(() => {
    AppearanceFixture.reset();
  });

  async function renderAsync(kind: UpdateState): Promise<ComponentFixture<UpdateItemComponent>> {
    state.set(kind);
    const fixture = TestBed.createComponent(UpdateItemComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<UpdateItemComponent>): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector("button.tr-update-item");
  }

  it("shows nothing while updates are off, while checking or downloading, and while TeamRun is up to date", async () => {
    const fixture = await renderAsync(of(UpdateStateKind.Off));
    const texts = [(fixture.nativeElement as HTMLElement).textContent];
    for (const next of [of(UpdateStateKind.Checking), of(UpdateStateKind.UpToDate), of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 })]) {
      state.set(next);
      await fixture.whenStable();
      texts.push((fixture.nativeElement as HTMLElement).textContent);
    }

    expect(texts).toEqual(["", "", "", ""]);
  });

  it("shows each state that needs the person, with its icon and text, and runs what the state offers", async () => {
    const fixture = await renderAsync(of(UpdateStateKind.Off));
    const shown: string[] = [];
    for (const next of [
      of(UpdateStateKind.Available, { version: "1.3.0", mustMove: true }),
      of(UpdateStateKind.Ready, { version: "1.3.0" }),
      of(UpdateStateKind.Failed),
      of(UpdateStateKind.Failed, { mustMove: true })
    ]) {
      state.set(next);
      await fixture.whenStable();
      const button = item(fixture);
      shown.push([...button?.querySelectorAll("span") ?? []].map(t => t.textContent?.trim()).join(" "));
      button?.click();
    }

    expect(shown).toEqual([
      "deployed_code_update Move to Applications to update",
      "restart_alt Restart to update",
      "error Update failed",
      "error Update failed"
    ]);
    expect(calls).toEqual(["About", "Restart", "About", "About"]);
    expect(item(fixture)?.querySelector(".tr-update-item-error")).not.toBeNull();
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync(of(UpdateStateKind.Failed));
        const away = document.body.appendChild(document.createElement("div"));
        Object.assign(away.style, { position: "fixed", right: "0", bottom: "0", width: "40px", height: "40px" });
        await userEvent.hover(away);
        away.remove();
        const button = item(fixture) as HTMLButtonElement;

        const itemStyle = getComputedStyle(button);
        const icon = getComputedStyle(button.querySelector(".tr-update-item-icon") as Element);

        expect(itemStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "errorForeground"));
        AppearanceFixture.expectLook(itemStyle.paddingLeft, theme, "pill-padding", "padding-left");
        AppearanceFixture.expectLook(itemStyle.height, theme, "status-bar-item-height", "height");
        AppearanceFixture.expectLook(itemStyle.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
        AppearanceFixture.expectLook(icon.fontSize, theme, "icon", "font-size");
      });
});
