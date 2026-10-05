/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DefaultTheme } from "@noldova/teamrun-shell-ui";

import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewDialogService } from "../../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

@Component({
  selector: "tr-test-changes",
  template: "<p class=\"tr-test-changes\">No changes</p>",
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestChangesComponent {
}

describe("ViewDialogComponent", () => {
  const { changes } = LayoutFixture;
  let dialogs: ViewDialogService;

  beforeEach(async () => {
    DesktopBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(changes.key, new ContributionMatch(() => Promise.resolve(TestChangesComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host }] });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry));
    dialogs = TestBed.inject(ViewDialogService);
  });

  afterEach(async () => {
    dialogs.close();
    await vi.waitFor(() => expect(document.querySelector("tr-view-dialog")).toBeNull());
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  for (const mode of AppearanceFixture.modes)
    it(`keeps focus on the close button for a view without controls and lays the view out on the panel surface filling the body, in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      void dialogs.showAsync(changes);
      await vi.waitFor(() => expect(document.querySelector(".tr-test-changes")).not.toBeNull());
      await TestBed.inject(ApplicationRef).whenStable();
      const content = document.querySelector("tr-tab-content") as HTMLElement;
      const body = (document.querySelector(".tr-dialog-body") as HTMLElement).getBoundingClientRect();
      const bounds = content.getBoundingClientRect();

      expect(document.activeElement?.classList.contains("tr-dialog-close")).toBe(true);
      expect(getComputedStyle(content).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "editor.background"));
      AppearanceFixture.expectPixels(bounds.width, body.width);
      AppearanceFixture.expectPixels(bounds.height, body.height);
    });

  it("pads a view it shows as a document, whatever dock the view belongs to", async () => {
    AppearanceFixture.apply();
    void dialogs.showAsync(changes);
    await vi.waitFor(() => expect(document.querySelector(".tr-test-changes")).not.toBeNull());
    await TestBed.inject(ApplicationRef).whenStable();
    const style = getComputedStyle(document.querySelector("tr-tab-content") as HTMLElement);

    AppearanceFixture.expectLook(style.paddingTop, DefaultTheme.theme, "document-padding-block", "padding-top");
    AppearanceFixture.expectLook(style.paddingBottom, DefaultTheme.theme, "document-padding-block", "padding-bottom");
    AppearanceFixture.expectLook(style.paddingLeft, DefaultTheme.theme, "content-padding-inline", "padding-left");
  });
});
