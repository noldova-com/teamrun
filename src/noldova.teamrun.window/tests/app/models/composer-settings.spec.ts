/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConversationResponder, DefaultTeammate, RequestedSettings } from "@noldova/teamrun.protocol";

import { ComposerSettings } from "../../../src/app/models/composer-settings";

describe("ComposerSettings", () => {
  it("names no responder by default and requests its provider, model and effort", () => {
    const settings = new ComposerSettings("codex", "gpt-5", "high", "a1");

    expect(settings.providerId).toBe("a1");
    expect(settings.responderTeammateId).toBeNull();
    expect(settings.toRequested().toJson()).toEqual({ kind: "codex", model: "gpt-5", effort: "high", speed: null, mode: null });
    expect(new ComposerSettings("codex", "gpt-5", null, "a1", null, "priority").toRequested().speed).toBe("priority");
    expect(new ComposerSettings("codex", "gpt-5", null, "a1", null, null, "full-access").toRequested().mode).toBe("full-access");
    expect(new ComposerSettings("codex", null, null, null, "bob").responderTeammateId).toBe("bob");
  });

  it("reads back what it writes, and reads blank or wrong values as unset", () => {
    const settings = new ComposerSettings("codex", "gpt-5", "high", "a1", "bob", "priority", "read-only");

    expect(ComposerSettings.fromJson(settings.toJson())?.equals(settings)).toBe(true);
    expect([ComposerSettings.fromJson(settings.toJson())?.speed, ComposerSettings.fromJson(settings.toJson())?.mode]).toEqual(["priority", "read-only"]);
    expect(ComposerSettings.fromJson({ kind: "codex", model: " ", effort: 3, providerId: null })?.toJson())
      .toEqual({ kind: "codex", model: null, effort: null, providerId: null, responderTeammateId: null, speed: null, mode: null });
    expect(ComposerSettings.fromJson({ kind: "" })).toBeNull();
    expect(ComposerSettings.fromJson([])).toBeNull();
    expect(ComposerSettings.fromJson("codex")).toBeNull();
  });

  it("starts with the default teammate's provider, model, effort and mode once one is chosen, and with the last sent choice in the default mode until then", () => {
    const sent = new ComposerSettings("claude", "opus", "max", "a2", null, "fast", "plan");

    expect(ComposerSettings.startingWith(new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a1"), sent)?.toJson())
      .toEqual({ kind: "codex", model: "gpt-5", effort: "high", providerId: "a1", responderTeammateId: null, speed: null, mode: null });
    expect(ComposerSettings.startingWith(new DefaultTeammate(new RequestedSettings("codex", null, null)), null)?.toJson())
      .toEqual({ kind: "codex", model: null, effort: null, providerId: null, responderTeammateId: null, speed: null, mode: null });
    expect(ComposerSettings.startingWith(new DefaultTeammate(new RequestedSettings("codex", "gpt-5", null, "flex"), "a1"), null)?.speed).toBe("flex");
    expect(ComposerSettings.startingWith(new DefaultTeammate(new RequestedSettings("codex", "gpt-5", null, null, "read-only"), "a1"), null)?.mode).toBe("read-only");
    expect(ComposerSettings.startingWith(null, sent)?.toJson()).toEqual({ ...sent.toJson(), mode: null });
    expect(ComposerSettings.startingWith(null, null)).toBeNull();
  });

  it("changes only its responder, provider or mode and compares every choice", () => {
    const settings = new ComposerSettings("codex", "gpt-5", "high", "a1", "bob", "priority", "read-only");
    const changed = settings.withResponder(null);

    expect(changed.toJson()).toEqual({ ...settings.toJson(), responderTeammateId: null });
    expect(settings.withProvider("a2").toJson()).toEqual({ ...settings.toJson(), providerId: "a2" });
    expect(settings.withMode(null).toJson()).toEqual({ ...settings.toJson(), mode: null });
    expect(settings.withMode("plan").toJson()).toEqual({ ...settings.toJson(), mode: "plan" });
    expect(changed.equals(settings)).toBe(false);
    expect(changed.equals(null)).toBe(false);
    expect(settings.equals(new ComposerSettings("claude", "gpt-5", "high", "a1", "bob"))).toBe(false);
    expect(settings.equals(new ComposerSettings("codex", "other", "high", "a1", "bob"))).toBe(false);
    expect(settings.equals(new ComposerSettings("codex", "gpt-5", "low", "a1", "bob"))).toBe(false);
    expect(settings.equals(new ComposerSettings("codex", "gpt-5", "high", "a2", "bob", "priority"))).toBe(false);
    expect(settings.equals(new ComposerSettings("codex", "gpt-5", "high", "a1", "bob", null, "read-only"))).toBe(false);
    expect(settings.equals(new ComposerSettings("codex", "gpt-5", "high", "a1", "bob", "priority"))).toBe(false);
    expect(settings.equals(changed.withResponder("bob"))).toBe(true);
    expect(settings.following(new ConversationResponder(null, new RequestedSettings("codex", "gpt-5", null, "flex"), "a1")).speed).toBe("flex");
    expect(settings.following(new ConversationResponder(null, new RequestedSettings("codex", "gpt-5", null, null, "auto"), "a1")).mode).toBe("auto");
  });
});
