/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AuthStatus, DiscoveredProfile, ProviderKind, ProviderKindInstallation, ProviderKindInstallState, ProviderTool } from "@noldova/teamrun.protocol";

import { ProviderWizardRow } from "../../../src/app/models/provider-wizard-row";
import { Resources } from "../../../src/resources";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ProviderWizardRow", () => {
  const claude = new ProviderKind("claude", "Claude Code", true);
  const antigravity = new ProviderKind("antigravity", "Antigravity", true);
  const page = "https://claude.com/pricing";
  const read = (row: ProviderWizardRow): string => [row.status, row.isInstalled, row.isInstalling, row.canInstall].join(" | ");

  it("says a command-line tool is found with its version or isn't on this computer, with an install command or none, or installing in a terminal", () => {
    const found = new ProviderWizardRow(claude, new ProviderTool("claude", true, "2.1.211", "install", page), null, [SampleData.provider], [], false);
    const missing = new ProviderWizardRow(claude, new ProviderTool("claude", false, null, "install", page), null, [], [], false);
    const installing = new ProviderWizardRow(claude, new ProviderTool("claude", false, null, "install", page), null, [], [], true);
    const commandless = new ProviderWizardRow(claude, new ProviderTool("claude", false), null, [], [], false);
    const versionless = new ProviderWizardRow(claude, new ProviderTool("claude", true), null, [], [], false);

    expect(read(found)).toBe(`${Resources.formatToolFound("Claude Code", "2.1.211")} | true | false | false`);
    expect(read(missing)).toBe(`${Resources.formatToolMissing("Claude Code")} | false | false | true`);
    expect(read(installing)).toBe(`${Resources.toolInstallingText} | false | true | false`);
    expect(read(commandless)).toBe(`${Resources.formatToolMissing("Claude Code")} | false | false | false`);
    expect(versionless.status).toBe("Installed: TeamRun runs Claude Code through its command-line tool, found on this computer.");
    expect([found.providers, found.found, missing.subscribeUrl, commandless.subscribeUrl]).toEqual([[SampleData.provider], [], page, null]);
  });

  it("offers a subscription only for a kind with no provider added and no profile folder found", () => {
    const tool = new ProviderTool("claude", true, "2.1.211", null, page);
    const profile = new DiscoveredProfile("claude", "D:\\profiles\\claude", "Claude Code", true, AuthStatus.LoggedIn);
    const subscribe = (providers: typeof SampleData.provider[], found: DiscoveredProfile[]): string | null =>
      new ProviderWizardRow(claude, tool, null, providers, found, false).subscribeUrl;

    expect([subscribe([], []), subscribe([SampleData.provider], []), subscribe([], [profile])]).toEqual([page, null, null]);
  });

  it("says a provider TeamRun installs runs through its own copy, from its installation, with its download's progress and the reason it can't be installed", () => {
    const state = (installation: ProviderKindInstallation): string => read(new ProviderWizardRow(antigravity, null, installation, [], [], false));

    expect(state(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed))).toBe(`${Resources.formatOwnCopyInstalled("Antigravity", null, null)} | true | false | false`);
    expect(state(new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled))).toBe(`${Resources.formatOwnCopyMissing("Antigravity")} | false | false | true`);
    expect(state(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installing, null, 50, 200))).toBe("Installing… 25% | false | true | false");
    expect(state(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installing, null, 200, 200, null, null, false)))
      .toBe("Installing… setting up | false | true | false");
    expect(state(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Unavailable, "No build for this computer.")))
      .toBe("No build for this computer. | false | false | false");
  });

  it("offers an installed provider's update with both versions, shows Updating while it runs, tells an update from an install, and why it failed in the version's place", () => {
    const row = (installation: ProviderKindInstallation): ProviderWizardRow => new ProviderWizardRow(claude,
      new ProviderTool("claude", true, "2.1.210", null, page), installation, [], [], false);
    const updatable = row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installed, null, 0, 0, "2.1.211", "2.1.212"));
    const current = row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installed, null, 0, 0, "2.1.212"));
    const updating = row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 50, 200, "2.1.211"));
    const failed = row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installed, "The download failed its check.", 0, 0, "2.1.211", "2.1.212"));

    expect([read(updatable), updatable.canUpdate]).toEqual([`${Resources.formatOwnCopyInstalled("Claude Code", "2.1.211", "2.1.212")} | true | false | false`, true]);
    expect([read(current), current.canUpdate]).toEqual([`${Resources.formatOwnCopyInstalled("Claude Code", "2.1.212", null)} | true | false | false`, false]);
    expect([read(updating), updating.canUpdate]).toEqual(["Updating… 25% | false | true | false", false]);
    expect([read(failed), failed.canUpdate]).toEqual(["The download failed its check. | true | false | false", true]);
    expect([updatable, updating, failed, row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 50, 200))].map(t => t.isUpdating))
      .toEqual([false, true, false, false]);
    expect(row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installed)).status).toBe(Resources.formatOwnCopyInstalled("Claude Code", "2.1.210", null));
  });

  it("can cancel an install TeamRun runs only while that install says it can, and never a tool's install", () => {
    const row = (installation: ProviderKindInstallation | null, installingTool: boolean = false): ProviderWizardRow =>
      new ProviderWizardRow(claude, null, installation, [], [], installingTool);

    expect([
      row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 50, 200)),
      row(new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 200, 200, null, null, false)),
      row(new ProviderKindInstallation("claude", ProviderKindInstallState.NotInstalled)),
      row(null, true)
    ].map(t => t.canCancelInstall)).toEqual([true, false, false, false]);
  });

  it("takes a kind without a tool or an installation as installed, since nothing says otherwise", () => {
    expect(read(new ProviderWizardRow(claude, null, null, [], [], false))).toBe(`${Resources.toolInstalledText} | true | false | false`);
  });
});
