/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageStatus, ProviderKindInstallation, ProviderKindInstallState } from "@noldova/teamrun.protocol";

import { ChatAction } from "../src/app/enums/chat-action";
import { Resources } from "../src/resources";

describe("Resources", () => {
  it("titles every chat action's failure, each its own", () => {
    const titles = Object.values(ChatAction).map(t => Resources.chatActionTitles[t]);

    expect([titles.every(t => t.startsWith("Couldn't ")), new Set(titles).size]).toEqual([true, Object.values(ChatAction).length]);
  });

  it("titles each provider action's failure with the provider's name, and with the action's own title for a provider the window doesn't know", () => {
    expect(Object.entries(Resources.providerActionTitles).map(([action, title]) => [action, title("GitHub Copilot")])).toEqual([
      [ChatAction.AddProvider, "Couldn't add GitHub Copilot"],
      [ChatAction.ChangeProvider, "Couldn't change GitHub Copilot"],
      [ChatAction.EnableProvider, "Couldn't enable GitHub Copilot"],
      [ChatAction.DisableProvider, "Couldn't disable GitHub Copilot"],
      [ChatAction.CheckProvider, "Couldn't check GitHub Copilot's sign-in"],
      [ChatAction.SignIn, "Couldn't sign in to GitHub Copilot"],
      [ChatAction.SignOut, "Couldn't sign out of GitHub Copilot"],
      [ChatAction.InstallKind, "Couldn't install GitHub Copilot"],
      [ChatAction.RemoveProvider, "Couldn't remove GitHub Copilot"],
      [ChatAction.InstallTool, "Couldn't install GitHub Copilot's tool"]
    ]);
    expect([Resources.formatProviderActionTitle(ChatAction.SignOut, "Grok"), Resources.formatProviderActionTitle(ChatAction.SignOut, null)])
      .toEqual(["Couldn't sign out of Grok", Resources.chatActionTitles[ChatAction.SignOut]]);
  });

  const texts = (value: unknown): readonly string[] => {
    if (typeof value === "string" || typeof value === "function")
      return [String(value)];
    if (value instanceof Map)
      return [...value.values()].flatMap(t => texts(t));
    if (typeof value === "object" && value !== null)
      return Object.values(value).flatMap(t => texts(t));
    return [];
  };

  it("names the provider types the search looks for, up to five and then the others, one alone and the last after and", () => {
    expect([["Codex"], ["Codex", "Grok CLI"], ["A", "B", "C", "D", "E"], ["A", "B", "C", "D", "E", "F"]].map(t => Resources.formatLookingFor(t))).toEqual([
      "Looking for Codex…", "Looking for Codex and Grok CLI…", "Looking for A, B, C, D and E…", "Looking for A, B, C, D, E and the others…"]);
  });

  it("says a sign-in didn't finish before its command ended, and before it signed in for a terminal with no command", () => {
    expect([Resources.formatSignInUnfinished("cursor-agent login"), Resources.formatSignInUnfinished(null)])
      .toEqual(["Sign-in didn't finish: the terminal closed before cursor-agent login ended.", Resources.signInUnfinished]);
  });

  it("qualifies a TeamRun method or event name with the module's id", () => {
    expect(Resources.formatQualifiedName("MessagePage")).toBe("teamrun.messagePage");
    expect(Resources.formatQualifiedName("StateResyncRequested")).toBe("teamrun.stateResyncRequested");
  });

  it("says in a sentence why fast mode can't serve, generally for a reason it doesn't know, and nothing while it is pending", () => {
    expect(Resources.formatSpeedUnavailable("extra_usage_disabled")).toBe("Fast mode needs usage credits, which are turned off. Replies run at standard speed.");
    expect(Resources.formatSpeedUnavailable("cooldown")).toBe("Fast mode reached its rate limit and comes back after a cooldown. Replies run at standard speed.");
    expect(Resources.formatSpeedUnavailable("unknown")).toBe("Fast mode isn't available now. Replies run at standard speed.");
    expect(Resources.formatSpeedUnavailable("pending")).toBeNull();
    expect(Resources.formatSpeedUnavailable("tier_not_served", "Flex")).toBe("The provider served another speed. Replies run at Flex speed.");
    expect(Object.keys(Resources.speedReasons)).toEqual(["free", "preference", "extra_usage_disabled", "network_error", "not_first_party", "disabled_by_env",
      "model_not_allowed", "sdk_opt_in_required", "cooldown", "tier_not_served"]);
    expect(Object.values(Resources.speedReasons).every(t => /^[A-Z].*\.$/.test(t))).toBe(true);
  });

  it("names the teammate an error is about", () => {
    expect(Resources.formatTeammateError("Alice", "Reply in progress")).toBe("@Alice: Reply in progress");
  });

  it("never calls a provider an account in a text it holds or writes", () => {
    const all = Object.getOwnPropertyNames(Resources).flatMap(t => texts((Resources as unknown as Record<string, unknown>)[t]));

    expect(all.length).toBeGreaterThan(400);
    expect(all.filter(t => /account/i.test(t))).toEqual([]);
  });

  it("names a provider choice once when its label repeats the kind's name", () => {
    expect(Resources.formatMention("Coder")).toBe("@Coder");
    expect(Resources.formatProviderChoice("Codex", "Codex")).toBe("Codex");
    expect(Resources.formatProviderChoice("Codex", "Work")).toBe("Codex · Work");
    expect(Resources.formatLocalProvider("Work")).toBe("Work · This computer");
    expect(Resources.formatReplyProvider("Claude Code")).toBe("·\u00a0Claude Code");
  });

  it("writes the composer's accessible names and unavailable choices", () => {
    expect(Resources.formatRemoveAttachment("notes.txt")).toBe("Remove attachment: notes.txt");
    expect(Resources.formatChatPermissions("Accept edits")).toBe("Permissions in this chat: Accept edits");
    expect(Resources.formatChatPermissionsOf("Claude Code")).toBe("Permissions in this chat · Claude Code");
    expect(Resources.formatOwnDefaultMode("Opus")).toBe("Opus's default");
    expect(Resources.formatChangeDefaultMode("Opus")).toBe("Change Opus's default…");
    expect(Resources.formatPicker("@Coder · GPT-6 Sol · Medium · Personal · Codex")).toBe("Model and effort: @Coder · GPT-6 Sol · Medium · Personal · Codex");
    expect(Resources.formatPermissionsAndPicker("Full Access", "@Coder · GPT-6 Sol · Medium")).toBe("Permissions, model and effort: Full Access, @Coder · GPT-6 Sol · Medium");
    expect(Resources.formatUnavailable("Offline")).toBe("Offline (unavailable)");
    expect(Resources.formatUnlisted("old-model")).toBe("old-model (not in the current catalog)");
  });

  it("names the picker's teammate rows, a model it can't choose and its provider's default model", () => {
    expect(Resources.formatMention("Alice")).toBe("@Alice");
    expect(Resources.formatAppliesInChat("Alice")).toBe("Applies to @Alice in this chat.");
    expect(Resources.formatMakeDefault("Alice")).toBe("Make it @Alice's default");
    expect(Resources.formatModelUnavailable("GPT-6 Terra", "needs Codex 0.167")).toBe("GPT-6 Terra · needs Codex 0.167");
    expect(Resources.formatPercentLeft(82)).toBe("82% left");
    expect(Resources.formatEditTeammate("Alice")).toBe("Edit Alice…");
    expect(Resources.formatProviderDefault("Codex", "GPT-6.1-Sol")).toBe("Codex's default · GPT-6.1-Sol");
    expect(Resources.formatProviderDefault("Codex", null)).toBe("Codex's default");
    expect([Resources.formatDefaultModel("Opus 5.5"), Resources.formatDefaultModel(null)]).toEqual(["Default model · Opus 5.5", "Default model"]);
  });

  it("says chat, never conversation, in every text it holds", () => {
    const values = Object.values(Resources).flatMap((t: unknown) => t instanceof Map ? [...t.values()] : typeof t === "object" && t !== null ? Object.values(t) : [t]);
    const texts = values.filter((t): t is string => typeof t === "string" && t.includes(" "));

    expect(texts).toContain(Resources.newConversationLabel);
    expect(texts.filter(t => /conversation/i.test(t))).toEqual([]);
  });

  it("words the Projects view's questions and its Show more", () => {
    expect(Resources.formatDeleteText("First")).toBe("\"First\" and its messages are removed. This cannot be undone.");
    expect(Resources.formatReplaceFolderText("/work/site", "/work/docs")).toBe("From the next turn, this chat's teammates work in \"/work/docs\" instead of \"/work/site\". No files are copied, moved or changed.");
    expect(Resources.formatAttachedFolderKept("site")).toBe("The folder attached to it, \"site\", and its files stay as they are.");
    expect(Resources.formatForgetText("repo")).toBe("\"repo\" and every chat under it are removed from TeamRun. The folder itself stays.");
    expect(Resources.formatShowMore(2)).toBe("Show 2 more");
  });

  it("asks before an unrestricted mode with its description before the warning, and the warning alone for a mode without one", () => {
    const warning = "Codex won't ask you before it acts, and its own restrictions are off. Choose it only for work you'd let it do unattended.";

    expect(Resources.formatUnrestrictedModeText("Codex", "Edits files anywhere.")).toBe(`Edits files anywhere. ${warning}`);
    expect(Resources.formatUnrestrictedModeText("Codex", null)).toBe(warning);
    expect([Resources.formatUnrestrictedModeTitle("Full Access"), Resources.formatUseMode("Full Access")]).toEqual(["Use Full Access?", "Use Full Access"]);
  });

  it("names an effort level by its id with a capital, and no level as the model's default", () => {
    expect([Resources.formatEffort("xhigh"), Resources.formatEffort("low"), Resources.formatEffort(null)]).toEqual(["Xhigh", "Low", "Model default"]);
    expect(Resources.noEffortLevels).toBe("Effort levels unavailable. The model's default is used.");
  });

  it("heads each reply a chat's wake names by how it ended, and one that ended without text", () => {
    expect([MessageStatus.Cancelled, MessageStatus.Failed, MessageStatus.Interrupted].map(t => Resources.formatWakeReplyHeading("Bob", t, "Done.")))
      .toEqual(["Bob's reply was cancelled.", "Bob's reply failed.", "Bob's reply was interrupted."]);
    expect([null, "Done."].map(t => Resources.formatWakeReplyHeading("Bob", MessageStatus.Completed, t))).toEqual(["Bob replied without text.", "Bob replied:"]);
  });

  it("names a sub-agent's or command's wake by its kind, name and ending, one with no ending by how it was lost, and one with no name by its chat", () => {
    expect(["subAgent", "command"].map(t => Resources.formatTaskWakeLabel(t, "Search", "ended as completed")))
      .toEqual(["Sub-agent \"Search\" ended as completed", "Background command \"Search\" ended as completed"]);
    expect(["subAgent", "command"].map(t => Resources.formatTaskWakeLabel(t, "Search", null)))
      .toEqual(["Sub-agent \"Search\" didn't come back", "Background command \"Search\" was stopped"]);
    expect(["subAgent", "command"].map(t => Resources.formatTaskWakeLabel(t, null, null)))
      .toEqual(["A sub-agent of this chat didn't come back", "A background command of this chat was stopped"]);
  });

  it("words a reply's activity for one and for many", () => {
    expect(Resources.formatProvenance("codex", null, "high")).toBe("codex · high");
    expect([1, 2].map(t => Resources.formatCommandCount(t))).toEqual(["ran 1 command", "ran 2 commands"]);
    expect([1, 2].map(t => Resources.formatEditCount(t))).toEqual(["edited 1 file", "edited 2 files"]);
    expect([1, 2].map(t => Resources.formatReadCount(t))).toEqual(["read 1 file", "read 2 files"]);
    expect([1, 2].map(t => Resources.formatSearchCount(t))).toEqual(["searched once", "searched 2 times"]);
    expect([1, 2].map(t => Resources.formatThoughtCount(t))).toEqual(["thought once", "thought 2 times"]);
    expect([1, 2].map(t => Resources.formatOtherStepCount(t, false))).toEqual(["1 more step", "2 more steps"]);
    expect([1, 2].map(t => Resources.formatOtherStepCount(t, true))).toEqual(["1 step", "2 steps"]);
    expect(Resources.formatActivitySummary(["ran 1 command", "read 2 files"])).toBe("Ran 1 command, read 2 files");
    expect(Resources.formatActivitySummary([])).toBe("");
    expect([1, 2].map(t => Resources.formatAddCount(t))).toEqual(["added 1 file", "added 2 files"]);
    expect([1, 2].map(t => Resources.formatDeleteCount(t))).toEqual(["deleted 1 file", "deleted 2 files"]);
    expect([1, 3].map(t => Resources.formatShowMoreFiles(t))).toEqual(["Show 1 more file", "Show 3 more files"]);
    expect([null, "D:/copilot-work"].map(t => Resources.formatWithPlanChange("Note.", "copilot", t))).toEqual([
      `Note. If your Copilot plan changed, sign in again by running copilot login in a terminal, then choose ${Resources.refreshModelsLabel}; until then Copilot keeps the old plan's models.`,
      `Note. If your Copilot plan changed, sign in again by running copilot login in a terminal with COPILOT_HOME set to D:/copilot-work, then choose ${Resources.refreshModelsLabel}; until then Copilot keeps the old plan's models.`
    ]);
    expect(Resources.formatWithPlanChange("Note.", "claude", "D:/claude")).toBe("Note.");
  });

  it("writes a duration in its two largest units", () => {
    expect([-500, 12_400, 65_000, 3_599_000, 7_260_000].map(t => Resources.formatDuration(t))).toEqual(["0s", "12s", "1m 5s", "59m 59s", "2h 1m"]);
    expect(Resources.formatWorkedFor("3s")).toBe("Worked for 3s");
    expect(Resources.formatWorkingFor("3s")).toBe("Working for 3s");
    expect(Resources.formatThinkingFor("3s")).toBe("Thinking… 3s");
    expect(Resources.formatSavingCheckpointFor("3s")).toBe("Saving a checkpoint… 3s");
  });

  it("words a reply's running tasks for one and for many", () => {
    expect([Resources.formatRunningTasks(1), Resources.formatRunningTasks(3)]).toEqual(["1 task running", "3 tasks running"]);
  });

  it("words the questions before deleting or moving a chat without a project, by how many files its folder holds", () => {
    expect(Resources.formatDeleteWithFilesText("Scratch", 1)).toBe("\"Scratch\", its messages and the 1 file it holds are removed. This cannot be undone. "
      + "To keep the chat and its files, move it to a folder instead.");
    expect(Resources.formatDeleteWithFilesText("Scratch", 3)).toBe("\"Scratch\", its messages and the 3 files it holds are removed. This cannot be undone. "
      + "To keep the chat and its files, move it to a folder instead.");
    expect(Resources.formatMoveText(1, "site")).toBe("The 1 file this chat holds is copied to \"site\", and the chat goes on there. Its own Git history isn't copied.");
    expect(Resources.formatMoveText(2, "site")).toBe("The 2 files this chat holds are copied to \"site\", and the chat goes on there. Its own Git history isn't copied.");
  });

  it("names a new provider by the first free name, then numbers the last one, and words the add panel's install lines", () => {
    expect(Resources.nextProviderName([])).toBe("Personal");
    expect(Resources.nextProviderName(["personal"])).toBe("Work");
    expect(Resources.nextProviderName(["Personal", "Work", "Lab", "Spare"])).toBe("Spare 2");
    expect(Resources.nextProviderName(["Personal", "Work", "Lab", "Spare", "Spare 2"])).toBe("Spare 3");
    expect(Resources.nextProviderName(["Personal", "Work", "Lab", "Spare", "spare 3"])).toBe("Spare 2");
    expect([Resources.formatUnavailableStep("It needs unzip."), Resources.formatUnavailableStep(null)])
      .toEqual(["It needs unzip. Once it has, choose Try again.", "TeamRun can't install it on this computer. Choose Try again to check again."]);
    expect(Resources.formatShownAs("Work", "Claude Code")).toBe("Shown as \"Work · Claude Code\"");
    expect([Resources.formatKindInstalledNote(null), Resources.formatKindInstalledNote("0.166.0")]).toEqual(["Installed", "Installed · 0.166.0"]);
    expect([Resources.formatKindUnavailableNote("tar"), Resources.formatKindUnavailableNote(null)]).toEqual(["Needs tar first", "Can't install here"]);
    expect(Resources.formatAddInstalling("Claude Code", new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 43_000_000, 100_000_000)))
      .toBe("Installing Claude Code: downloading 41 of 96 MB");
    expect(Resources.formatAddInstalling("Claude Code", new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 0, 0, null, null, false)))
      .toBe("Installing Claude Code: setting up");
    expect(Resources.formatAddInstalling("Claude Code", new ProviderKindInstallation("claude", ProviderKindInstallState.Installing))).toBe("Installing Claude Code: starting");
    expect(Resources.formatToolInstallFailed("Grok CLI")).toBe("The install command ended without installing Grok CLI. Choose Add to run it again.");
  });

  it("words the Teammates, Providers and MCP servers views' questions, row actions, hints and failures", () => {
    expect(Resources.formatRowAction("Edit", "Alice")).toBe("Edit Alice");
    expect(Resources.formatOwnMcpServersUnread("codex was not found")).toBe("TeamRun couldn't read its configuration: codex was not found");
    expect(Resources.formatDeleteTeammate("Alice")).toBe("Delete @Alice? Their memberships will be removed. Existing messages will keep their name.");
    expect(Resources.formatRemoveQuestion([])).toBe("Remove it? Its folder and sign-in stay on this computer.");
    expect(Resources.formatRemoveQuestion(["Reviewer"]))
      .toBe("Remove it? Its folder and sign-in stay on this computer. @Reviewer uses it and will stop answering until you give them another provider.");
    expect(Resources.formatRemoveQuestion(["Reviewer", "Tester", "Writer"]))
      .toBe("Remove it? Its folder and sign-in stay on this computer. @Reviewer, @Tester and @Writer use it and will stop answering until you give them another provider.");
    expect(Resources.profileHintFor("codex")).toBe(
      "Choose the Codex profile that holds your CLI sign-in (usually the .codex folder in your home directory). TeamRun can sign Codex in too: choose Sign in in the provider's menu.");
    expect(Resources.profileHintFor("claude")).toBe("Choose your Claude CLI profile folder (usually .claude). A Claude desktop login does not necessarily " +
      "sign in this CLI profile: choose Sign in in the provider's menu to sign this profile in from a terminal.");
    expect(Resources.profileHintFor("copilot")).toBe("Choose your Copilot CLI folder (usually the .copilot folder in your home directory). Copilot CLI keeps its own " +
      "sign-in: choose Sign in in the provider's menu to sign this profile in from a terminal.");
    expect(Resources.formatTerminalInstallTitle("Claude Code")).toBe("Install Claude Code");
    expect(Resources.formatTerminalSignInTitle("Work")).toBe("Sign in Work");
    expect(Resources.formatTerminalSignInTitle("x".repeat(192))).toBe(`Sign in ${"x".repeat(192)}`);
    expect(Resources.formatTerminalSignInTitle("x".repeat(193))).toBe(`Sign in ${"x".repeat(191)}…`);
    expect(Resources.formatTerminalSignInTitle(`${"x".repeat(190)}\u{1F600}x`)).toBe(`Sign in ${"x".repeat(190)}…`);
    expect(Resources.formatTerminalSignInTitle(`${"x".repeat(189)}\u{1F600}x`)).toBe(`Sign in ${"x".repeat(189)}\u{1F600}x`);
    expect(Resources.profileHintFor("grok")).toBe(
      "Choose your Grok home (usually the .grok folder in your home directory); Grok in TeamRun uses its settings, memory, rules, MCP servers and " +
        "sign-in, shared with your own Grok CLI, so signing in here replaces its sign-in and signing out signs it out too; another folder keeps a " +
        "sign-in of its own. TeamRun signs Grok in: after adding the provider, choose Sign in in its menu.");
    expect(Resources.profileHintFor("antigravity")).toBe(
      "Choose an empty folder for this Antigravity profile, such as a new folder under profiles/antigravity in TeamRun's data folder. TeamRun installs Antigravity and signs it in with Google: choose Install here, then, after adding the provider, Sign in in its menu.");
    expect(Resources.profileHintFor("cursor")).toBe("Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data folder; your own " +
      "Cursor setup stays separate. Cursor signs in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login for this profile. " +
      "Cursor in TeamRun also starts the MCP servers in your ~/.cursor/mcp.json, outside the profile.");
    expect(Resources.profileHintFor("cursor", true)).toBe("Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data folder. " +
      "On this Mac, Cursor keeps its sign-in in the keychain, shared with your own Cursor CLI: signing in here replaces your Cursor CLI's sign-in, and signing " +
      "out signs it out too. Cursor signs in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login for this profile. " +
      "Cursor in TeamRun also starts the MCP servers in your ~/.cursor/mcp.json, outside the profile.");
    expect(Resources.profileHintFor("cursor", false, true)).toBe("Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data " +
      "folder; your own Cursor setup stays separate. Cursor signs in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login " +
      "for this profile. Cursor in TeamRun also starts the MCP servers in your %USERPROFILE%\\.cursor\\mcp.json, outside the profile.");
    expect(Resources.profileHintFor("grok", true)).toBe(Resources.profileHintFor("grok"));
    expect(Resources.profileHintFor("grok", false, true)).toBe(Resources.profileHintFor("grok"));
    expect(Resources.profileHintFor("other")).toBe("Use the full path to the profile folder. Sign-in is managed by the provider's own application.");
    expect(Resources.profileHintFor("")).toBe("Choose a provider first; the hint then says where its profile folder usually is.");
  });
});
