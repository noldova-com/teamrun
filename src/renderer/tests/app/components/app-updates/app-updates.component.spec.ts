/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { Resources } from "../../../../src/app/resources";
import { AppUpdatesComponent } from "../../../../src/app/components/app-updates/app-updates.component";

describe("AppUpdatesComponent", () => {
  it("offers restart only for an enabled verified download and disables it during preparation", async () => {
    const fixture = TestBed.createComponent(AppUpdatesComponent);
    const commands: AppUpdateCommand[] = [];
    fixture.componentInstance.command.subscribe(t => commands.push(t));
    fixture.componentRef.setInput("state", new AppUpdateState(AppUpdateStatus.Downloaded, "1.0.0", "2.0.0", 100, null, null, true, true));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>("button")!;
    expect(button.textContent).toContain("Restart to update");
    button.click();
    expect(commands).toEqual([AppUpdateCommand.Install]);
    fixture.componentRef.setInput("state", new AppUpdateState(AppUpdateStatus.Preparing, "1.0.0", "2.0.0", 100, null, null, true, true));
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
  });
  it("offers explicit check/download/retry actions and disables them during work", async () => {
    const fixture = TestBed.createComponent(AppUpdatesComponent);
    const element: HTMLElement = fixture.nativeElement;
    const commands: AppUpdateCommand[] = [];
    fixture.componentInstance.command.subscribe(t => commands.push(t));
    fixture.componentRef.setInput("state", new AppUpdateState(AppUpdateStatus.Available, "0.0.1", "0.0.2", null, null, null, true));
    await fixture.whenStable();
    const buttons = element.querySelectorAll("button");
    buttons[0]?.click();
    buttons[1]?.click();
    expect(commands).toEqual([AppUpdateCommand.Check, AppUpdateCommand.Download]);
    expect(element.textContent).toContain("Installed version: 0.0.1");
    expect(element.textContent).toContain(Resources.updateTestFeedLabel);
    fixture.componentRef.setInput("state", new AppUpdateState(AppUpdateStatus.Downloading, "0.0.1", "0.0.2", 42, null, null, true));
    await fixture.whenStable();
    expect(Array.from(element.querySelectorAll("button")).every(t => t.disabled)).toBe(true);
    expect(element.textContent).toContain("42%");
    fixture.componentRef.setInput("state", new AppUpdateState(AppUpdateStatus.Error, "0.0.1", "0.0.2", null, "Download failed", null, true));
    await fixture.whenStable();
    expect(element.textContent).toContain(Resources.retryDownloadLabel);
    expect(element.textContent).toContain("Download failed");
  });

  it("never offers installation and explains disabled or downloaded states", async () => {
    const fixture = TestBed.createComponent(AppUpdatesComponent);
    const element: HTMLElement = fixture.nativeElement;
    for (const status of [AppUpdateStatus.Disabled, AppUpdateStatus.Downloaded]) {
      fixture.componentRef.setInput("state", new AppUpdateState(status, "0.0.1", null, null, "Explanation", null, false));
      await fixture.whenStable();
      expect(element.querySelectorAll("button").length).toBe(0);
      expect(element.textContent).toContain("Explanation");
    }
    fixture.componentRef.setInput("error", Resources.updateBridgeFailed);
    await fixture.whenStable();
    const commands: AppUpdateCommand[] = [];
    fixture.componentInstance.command.subscribe(t => commands.push(t));
    element.querySelector("button")?.click();
    expect(commands).toEqual([AppUpdateCommand.Status]);
    expect(element.querySelector("[role=alert]")?.textContent).toContain(Resources.updateBridgeFailed);
  });
});
