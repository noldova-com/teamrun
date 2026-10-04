/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IKeyStroke, KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class KeyChordTests {
  @TestMethod
  public readsModifiersInAnyOrderAndWritesThemInOne(): void {
    const chord = KeyChord.parse("Shift+Alt+Mod+K", "shortcut");

    Assert.areEqual("Mod+Alt+Shift+K", chord.text);
    Assert.areEqual("Mod+Alt+Shift+K", chord.toString());
    Assert.isTrue(chord.hasMod && chord.hasAlt && chord.hasShift && !chord.hasCtrl);
    Assert.areEqual("K", chord.key.token);
    Assert.areEqual("Ctrl+F2", KeyChord.parse("Ctrl+F2").text);
  }

  @TestMethod
  public refusesTextThatIsNotAChord(): void {
    for (const text of ["", "Mod+", "+K", "Mod+Mod+K", "Cmd+K", "Meta+K", "Super+K", "mod+K", "Mod+k", "Mod+Plus"]) {
      const exception = Assert.throws(() => KeyChord.parse(text, "shortcut"), ArgumentException, text);
      Assert.areEqual("shortcut", exception.parameterName);
      Assert.isTrue(exception.message.startsWith(`"${text}" is not a key.`), exception.message);
    }
    const ambiguous = Assert.throws(() => KeyChord.parse("Mod+Ctrl+K"), ArgumentException);
    Assert.areEqual("\"Mod+Ctrl+K\" names both Mod and Ctrl, which are the same key on Windows and Linux. (Parameter 'key')", ambiguous.message);
  }

  @TestMethod
  public findsAChordWithoutThrowing(): void {
    Assert.areEqual("Mod+Alt+Shift+K", KeyChord.find("Shift+Alt+Mod+K")?.text);
    for (const text of ["", "Mod+", "Mod+Mod+K", "Cmd+K", "Mod+Ctrl+K"])
      Assert.isNull(KeyChord.find(text), text);
  }

  @TestMethod
  public tellsWhichChordsCouldTakeTyping(): void {
    for (const text of ["K", "Shift+K", "Enter", "Shift+Space"])
      Assert.isTrue(KeyChord.parse(text).isTypingKey, text);
    for (const text of ["Mod+K", "Ctrl+K", "Alt+K", "F2", "Shift+F10"])
      Assert.isFalse(KeyChord.parse(text).isTypingKey, text);
  }

  @TestMethod
  public matchesModAsCtrlOnWindowsAndLinuxAndCmdOnMacOs(): void {
    const chord = KeyChord.parse("Mod+Shift+K");
    const control = KeyChordTests.stroke("K", "KeyK", { ctrlKey: true, shiftKey: true });
    const command = KeyChordTests.stroke("K", "KeyK", { metaKey: true, shiftKey: true });

    Assert.isTrue(chord.matches(control, "win32"));
    Assert.isTrue(chord.matches(control, "linux"));
    Assert.isFalse(chord.matches(command, "win32"));
    Assert.isTrue(chord.matches(command, "darwin"));
    Assert.isFalse(chord.matches(control, "darwin"));
  }

  @TestMethod
  public matchesCtrlAsControlEverywhereAndModifiersExactly(): void {
    const chord = KeyChord.parse("Ctrl+Alt+Backquote");

    Assert.isTrue(chord.matches(KeyChordTests.stroke("`", "Backquote", { ctrlKey: true, altKey: true }), "darwin"));
    Assert.isTrue(chord.matches(KeyChordTests.stroke("`", "Backquote", { ctrlKey: true, altKey: true }), "linux"));
    Assert.isFalse(chord.matches(KeyChordTests.stroke("`", "Backquote", { ctrlKey: true, altKey: true, shiftKey: true }), "linux"));
    Assert.isFalse(chord.matches(KeyChordTests.stroke("`", "Backquote", { ctrlKey: true }), "linux"));
    Assert.isFalse(chord.matches(KeyChordTests.stroke("`", "Backquote", { ctrlKey: true, altKey: true, metaKey: true }), "darwin"));
    Assert.isFalse(chord.matches(KeyChordTests.stroke("1", "Digit1", { ctrlKey: true, altKey: true }), "linux"));
  }

  @TestMethod
  public comparesChordsByTheKeysAPlatformPresses(): void {
    const mod = KeyChord.parse("Mod+K");
    const ctrl = KeyChord.parse("Ctrl+K");

    Assert.isTrue(mod.isSameOn(ctrl, "win32"));
    Assert.isFalse(mod.isSameOn(ctrl, "darwin"));
    Assert.isTrue(mod.isSameOn(KeyChord.parse("Mod+K"), "darwin"));
    Assert.isFalse(mod.isSameOn(KeyChord.parse("Mod+J"), "win32"));
    Assert.isFalse(mod.isSameOn(KeyChord.parse("Mod+Alt+K"), "win32"));
    Assert.isFalse(mod.isSameOn(KeyChord.parse("Mod+Shift+K"), "darwin"));
    Assert.isFalse(KeyChord.parse("Alt+K").isSameOn(mod, "linux"));
  }

  @TestMethod
  public labelsMacOsWithSymbolsInItsOrder(): void {
    Assert.areEqual("\u2303\u2325\u21E7K", KeyChord.parse("Shift+Alt+Ctrl+K").label("darwin"));
    Assert.areEqual("\u2325\u21E7\u2318K", KeyChord.parse("Mod+Alt+Shift+K").label("darwin"));
    Assert.areEqual("\u2303\u21A9", KeyChord.parse("Ctrl+Enter").label("darwin"));
    Assert.areEqual("\u2318,", KeyChord.parse("Mod+Comma").label("darwin"));
    Assert.areEqual("F2", KeyChord.parse("F2").label("darwin"));
  }

  @TestMethod
  public labelsWindowsAndLinuxWithNamesJoinedByPlus(): void {
    Assert.areEqual("Ctrl+Alt+Shift+K", KeyChord.parse("Shift+Alt+Mod+K").label("win32"));
    Assert.areEqual("Ctrl+Esc", KeyChord.parse("Ctrl+Escape").label("linux"));
    Assert.areEqual("Alt+Up", KeyChord.parse("Alt+ArrowUp").label("win32"));
    Assert.areEqual("F2", KeyChord.parse("F2").label("linux"));
  }

  @TestMethod
  public acceptsDefaultsThatCannotTakeTyping(): void {
    for (const text of ["Mod+Alt+N", "Ctrl+Shift+Backquote", "Alt+F2", "F5", "Shift+F10", "Ctrl+Q", "Ctrl+W", "Alt+Escape"])
      Assert.areEqual(KeyChord.parse(text).text, KeyChord.parseDefault(text).text, text);
  }

  @TestMethod
  public refusesDefaultsWithoutAGuardingModifier(): void {
    for (const text of ["K", "Shift+K", "Enter", "Shift+Space"]) {
      const exception = Assert.throws(() => KeyChord.parseDefault(text, "defaultKey"), ArgumentException, text);
      Assert.areEqual("defaultKey", exception.parameterName);
      Assert.areEqual(`The default key ${KeyChord.parse(text).text} needs Mod, Ctrl or Alt, or a function key, so that typing is never taken. (Parameter 'defaultKey')`, exception.message);
    }
  }

  @TestMethod
  public refusesTheEditingKeysEverywhere(): void {
    for (const text of ["Mod+A", "Mod+C", "Mod+V", "Mod+X", "Mod+Z", "Mod+Y", "Mod+Shift+Z", "Ctrl+C", "Ctrl+Shift+Z"])
      Assert.isTrue(Assert.throws(() => KeyChord.parseDefault(text), ArgumentException, text).message.includes("is reserved for editing"), text);
  }

  @TestMethod
  public refusesTheKeysMacOsOwns(): void {
    for (const text of ["Mod+Q", "Mod+W", "Mod+H", "Mod+M", "Mod+Comma", "Mod+Tab", "Mod+Space", "Mod+Alt+Escape"])
      Assert.areEqual(
        `The key ${KeyChord.parse(text).text} is reserved for macOS and cannot be a command's default. (Parameter 'key')`,
        Assert.throws(() => KeyChord.parseDefault(text), ArgumentException, text).message);
  }

  @TestMethod
  public refusesTheKeysWindowsAndLinuxOwn(): void {
    for (const text of ["Alt+F4", "Alt+Tab", "Mod+Escape", "Ctrl+Escape"])
      Assert.areEqual(
        `The key ${KeyChord.parse(text).text} is reserved for Windows and Linux and cannot be a command's default. (Parameter 'key')`,
        Assert.throws(() => KeyChord.parseDefault(text), ArgumentException, text).message);
  }

  @TestMethod
  public namesWhoOwnsAReservedChord(): void {
    const module = QualifiedName.parse("notes.create");
    const shell = QualifiedName.parse("shell.closeTab");

    Assert.areEqual("editing", KeyChord.parse("Ctrl+C").findReservedOwner(null));
    Assert.areEqual("editing", KeyChord.parse("Mod+C").findReservedOwner(shell));
    Assert.areEqual("macOS", KeyChord.parse("Mod+W").findReservedOwner(module));
    Assert.areEqual("macOS", KeyChord.parse("Mod+Q").findReservedOwner(shell));
    Assert.areEqual("Windows and Linux", KeyChord.parse("Ctrl+Escape").findReservedOwner(module));
    Assert.isNull(KeyChord.parse("Mod+W").findReservedOwner(shell));
    Assert.isNull(KeyChord.parse("Mod+Comma").findReservedOwner(shell));
    Assert.isNull(KeyChord.parse("Ctrl+W").findReservedOwner(null));
    Assert.isNull(KeyChord.parse("Mod+K").findReservedOwner(module));
  }

  @TestMethod
  public bindsWhatADefaultMayTakeAndTheShellsOwnKeysToShellCommands(): void {
    const module = QualifiedName.parse("notes.create");
    const shell = QualifiedName.parse("shell.openSettings");

    for (const text of ["Mod+Alt+N", "Ctrl+W", "F5", "Alt+Escape"]) {
      Assert.areEqual(KeyChord.parse(text).text, KeyChord.parseBinding(text, module).text, text);
      Assert.isTrue(KeyChord.parse(text).canBind(module), text);
    }
    for (const text of ["Mod+W", "Mod+Comma"]) {
      Assert.areEqual(text, KeyChord.parseBinding(text, shell).text);
      Assert.isTrue(KeyChord.parse(text).canBind(shell), text);
      Assert.isFalse(KeyChord.parse(text).canBind(module), text);
    }
    Assert.isFalse(KeyChord.parse("Shift+K").canBind(shell));
    Assert.isFalse(KeyChord.parse("Mod+V").canBind(shell));
  }

  @TestMethod
  public refusesABindingWithTheReason(): void {
    const module = QualifiedName.parse("notes.create");
    const typing = Assert.throws(() => KeyChord.parseBinding("Shift+K", module, "binding"), ArgumentException);
    Assert.areEqual("The key Shift+K needs Mod, Ctrl or Alt, or a function key, so that typing is never taken. (Parameter 'binding')", typing.message);
    Assert.areEqual(
      "The key Mod+Comma is reserved for macOS and cannot be bound to a command. (Parameter 'key')",
      Assert.throws(() => KeyChord.parseBinding("Mod+Comma", module), ArgumentException).message);
    Assert.isTrue(Assert.throws(() => KeyChord.parseBinding("Mod+Plus", module), ArgumentException).message.startsWith("\"Mod+Plus\" is not a key."));
  }

  @TestMethod
  public recordsTheChordAStrokePressesOnEachPlatform(): void {
    const control = KeyChordTests.stroke("k", "KeyK", { ctrlKey: true, shiftKey: true });
    const command = KeyChordTests.stroke("k", "KeyK", { metaKey: true, altKey: true });

    Assert.areEqual("Mod+Shift+K", KeyChord.fromStroke(control, "win32")?.text);
    Assert.areEqual("Mod+Shift+K", KeyChord.fromStroke(control, "linux")?.text);
    Assert.areEqual("Ctrl+Shift+K", KeyChord.fromStroke(control, "darwin")?.text);
    Assert.areEqual("Mod+Alt+K", KeyChord.fromStroke(command, "darwin")?.text);
    Assert.areEqual("F2", KeyChord.fromStroke(KeyChordTests.stroke("F2", "F2", {}), "win32")?.text);
    for (const platform of ["win32", "linux", "darwin"]) {
      const chord = KeyChord.fromStroke(control, platform);
      Assert.isTrue(chord?.matches(control, platform) === true, platform);
    }
  }

  @TestMethod
  public recordsNothingForAStrokeNoChordCanName(): void {
    Assert.isNull(KeyChord.fromStroke(KeyChordTests.stroke("k", "KeyK", { metaKey: true }), "win32"));
    Assert.isNull(KeyChord.fromStroke(KeyChordTests.stroke("k", "KeyK", { metaKey: true, ctrlKey: true }), "linux"));
    Assert.isNull(KeyChord.fromStroke(KeyChordTests.stroke("k", "KeyK", { metaKey: true, ctrlKey: true }), "darwin"));
    Assert.isNull(KeyChord.fromStroke(KeyChordTests.stroke("Control", "ControlLeft", { ctrlKey: true }), "win32"));
  }

  private static stroke(key: string, code: string, modifiers: Partial<Omit<IKeyStroke, "key" | "code">>): IKeyStroke {
    return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers };
  }
}
