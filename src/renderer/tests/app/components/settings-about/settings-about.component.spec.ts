/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { SampleData } from "../../../fixtures/sample-data";
import { SettingsAboutComponent } from "../../../../src/app/components/settings-about/settings-about.component";

describe("SettingsAboutComponent", () => {
  it("opens the website and the latest release page in the browser", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [SettingsAboutComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(SettingsAboutComponent);
    const element: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.textContent).toContain("Download the latest version");
    });

    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>("button"));
    buttons.find(t => t.textContent?.includes("teamrun.ai"))!.click();
    buttons.find(t => t.textContent?.includes("Download the latest version"))!.click();

    expect(bridge.openedUrls).toEqual(["https://teamrun.ai", "https://github.com/noldova-com/teamrun/releases/latest"]);
  });
});
