/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { CommandTitleReader, ShellDialect } from "@noldova/teamrun.providers";

@TestClass
export class CommandTitleReaderTests {
  @TestMethod
  @TestData("rg foo", "Searched for foo")
  @TestData("rg -n foo src", "Searched for foo in src")
  @TestData("rg -e 'a b' src tests", "Searched for a b in src, tests")
  @TestData("rg -tts foo", "Searched for foo")
  @TestData("rg --glob '*.ts' foo .", "Searched for foo in .")
  @TestData("rg --glob=*.ts foo", "Searched for foo")
  @TestData("rg --regexp=foo src", "Searched for foo in src")
  @TestData("rg foo\\ bar", "Searched for foo bar")
  @TestData("rg \"foo\\\"bar\"", "Searched for foo\"bar")
  @TestData("rg a#b", "Searched for a#b")
  @TestData("\"rg\" foo", "Searched for foo")
  @TestData("grep -rn -- -x src", "Searched for -x in src")
  @TestData("grep -A 3 foo a.ts", "Searched for foo in a.ts")
  @TestData("grep -niE \"a|b\" .", "Searched for a|b in .")
  @TestData("/usr/bin/grep foo", "Searched for foo")
  @TestData("cat a.ts b.ts", "Read a.ts, b.ts")
  @TestData("cat 'a b' \"c d\"", "Read a b, c d")
  @TestData("head -n 20 a.ts", "Read the start of a.ts")
  @TestData("head -20 a.ts", "Read the start of a.ts")
  @TestData("tail --lines=5 log.txt", "Read the end of log.txt")
  @TestData("ls", "Listed the folder")
  @TestData("ls -la src", "Listed src")
  @TestData("ls --color=auto", "Listed the folder")
  @TestData("ls -R", "Listed the folder and its subfolders")
  @TestData("ls -laR src", "Listed src and its subfolders")
  @TestData("cd src", "Changed to src")
  @TestData("pushd \"my dir\"", "Changed to my dir")
  @TestData("git status", "Checked the git status")
  @TestData("git --no-pager diff", "Viewed the git diff")
  @TestData("git log --oneline -5", "Viewed the git log")
  public titlesAPosixCommand(command: string, expected: string): void {
    Assert.areEqual(expected, CommandTitleReader.titleOf(command, ShellDialect.Posix));
  }

  @TestMethod
  @TestData("")
  @TestData("   ")
  @TestData("echo hi")
  @TestData("RG foo")
  @TestData("sudo cat a")
  @TestData("FOO=1 cat a")
  @TestData("env FOO=1 cat a")
  @TestData("./cat a")
  @TestData("../bin/rg foo")
  @TestData("bin/rg foo")
  @TestData("scripts/cat notes")
  @TestData("rg foo | head")
  @TestData("cat a && cat b")
  @TestData("cat a; ls")
  @TestData("cat a > b")
  @TestData("cat $HOME/a")
  @TestData("cat \"$HOME\"")
  @TestData("cat \"a`b\"")
  @TestData("cat a\nb")
  @TestData("ls # all")
  @TestData("rg 'foo")
  @TestData("rg foo\\")
  @TestData("rg")
  @TestData("rg -")
  @TestData("rg -e")
  @TestData("rg -Q foo")
  @TestData("rg --frobnicate foo")
  @TestData("rg --hidden=yes foo")
  @TestData("rg --glob")
  @TestData("cat")
  @TestData("cat -n a")
  @TestData("head a b")
  @TestData("head -q a")
  @TestData("head -n")
  @TestData("tail -f log")
  @TestData("ls a b")
  @TestData("ls -Z")
  @TestData("ls --sort=size")
  @TestData("cd")
  @TestData("cd -")
  @TestData("cd a b")
  @TestData("git")
  @TestData("git push")
  @TestData("git diff --output=x.patch")
  public leavesAPosixCommandItCannotTitleUntitled(command: string): void {
    Assert.isNull(CommandTitleReader.titleOf(command, ShellDialect.Posix));
  }

  @TestMethod
  @TestData("Get-Content a.ts", "Read a.ts")
  @TestData("gc -Path 'C:\\a b.txt'", "Read C:\\a b.txt")
  @TestData("Get-Content 'it''s.txt'", "Read it's.txt")
  @TestData("cat a.ts", "Read a.ts")
  @TestData("type a.ts", "Read a.ts")
  @TestData("Get-Content a.ts -TotalCount 20", "Read the start of a.ts")
  @TestData("Get-Content -Tail 5 log.txt", "Read the end of log.txt")
  @TestData("Get-ChildItem", "Listed the folder")
  @TestData("ls -Force", "Listed the folder")
  @TestData("dir src", "Listed src")
  @TestData("gci -Recurse src", "Listed src and its subfolders")
  @TestData("Get-ChildItem -Path src -Depth 2", "Listed src and its subfolders")
  @TestData("Select-String -Pattern foo -Path a.ts", "Searched for foo in a.ts")
  @TestData("sls foo a.ts", "Searched for foo in a.ts")
  @TestData("Select-String foo -SimpleMatch", "Searched for foo")
  @TestData("rg -n foo", "Searched for foo")
  @TestData("C:\\Tools\\rg.exe foo", "Searched for foo")
  @TestData("\\Tools\\rg.exe foo", "Searched for foo")
  @TestData("findstr /s /i foo *.ts", "Searched for foo in *.ts")
  @TestData("findstr /c:\"a b\" a.txt", "Searched for a b in a.txt")
  @TestData("Set-Location src", "Changed to src")
  @TestData("cd -Path 'my dir'", "Changed to my dir")
  @TestData("GIT.EXE status", "Checked the git status")
  public titlesAPowerShellCommand(command: string, expected: string): void {
    Assert.areEqual(expected, CommandTitleReader.titleOf(command, ShellDialect.PowerShell));
  }

  @TestMethod
  @TestData("Get-Date")
  @TestData(".\\rg.exe foo")
  @TestData("tools\\rg.exe foo")
  @TestData("tools/rg.exe foo")
  @TestData("Get-Content a.ts | Select-Object -First 5")
  @TestData("Get-Content $env:USERPROFILE\\a")
  @TestData("Get-Content \"a$b\"")
  @TestData("Get-Content @('a')")
  @TestData("Get-Content a.ts # x")
  @TestData("Get-Content")
  @TestData("Get-Content a b")
  @TestData("Get-Content a.ts -Wait")
  @TestData("Get-Content -Path")
  @TestData("Get-Content -Path a -Path b")
  @TestData("Get-Content a -TotalCount 1 -Tail 1")
  @TestData("Get-ChildItem a b")
  @TestData("Get-ChildItem -Wait")
  @TestData("Select-String")
  @TestData("Select-String foo a b")
  @TestData("Select-String foo -Wait")
  @TestData("findstr")
  @TestData("findstr /z foo")
  @TestData("findstr \"a b\" x")
  @TestData("Set-Location")
  @TestData("Set-Location a b")
  @TestData("Set-Location -Wait")
  public leavesAPowerShellCommandItCannotTitleUntitled(command: string): void {
    Assert.isNull(CommandTitleReader.titleOf(command, ShellDialect.PowerShell));
  }

  @TestMethod
  @TestData("type a.txt", "Read a.txt")
  @TestData("TYPE a.txt b.txt", "Read a.txt, b.txt")
  @TestData("type #a", "Read #a")
  @TestData("dir", "Listed the folder")
  @TestData("dir /b src", "Listed src")
  @TestData("dir /a:h", "Listed the folder")
  @TestData("DIR /S /B", "Listed the folder and its subfolders")
  @TestData("chdir src", "Changed to src")
  @TestData("cd /d D:\\work", "Changed to D:\\work")
  @TestData("findstr /n foo a.txt", "Searched for foo in a.txt")
  @TestData("\"C:\\Program Files\\Git\\cmd\\git.exe\" status", "Checked the git status")
  public titlesACmdCommand(command: string, expected: string): void {
    Assert.areEqual(expected, CommandTitleReader.titleOf(command, ShellDialect.Cmd));
  }

  @TestMethod
  @TestData("echo hi")
  @TestData("type a.txt | more")
  @TestData("type a ^& b")
  @TestData("tools\\findstr foo a.txt")
  @TestData("type %USERPROFILE%\\a.txt")
  @TestData("type \"a%b\"")
  @TestData("type /x a")
  @TestData("dir /z")
  @TestData("dir a b")
  @TestData("cd /d")
  public leavesACmdCommandItCannotTitleUntitled(command: string): void {
    Assert.isNull(CommandTitleReader.titleOf(command, ShellDialect.Cmd));
  }

  @TestMethod
  @TestData("bash -lc 'rg -n foo src'", "Searched for foo in src")
  @TestData("/bin/zsh -c 'git status'", "Checked the git status")
  @TestData("pwsh -Command 'Get-Content a.ts'", "Read a.ts")
  @TestData("cmd.exe /d /s /c 'dir /b'", "Listed the folder")
  public titlesTheScriptAShellWrapperRunsInItsDialect(command: string, expected: string): void {
    Assert.areEqual(expected, CommandTitleReader.titleOfCall(command));
  }

  @TestMethod
  @TestData("ls")
  @TestData("npm test")
  @TestData("bash -lc 'npm test'")
  @TestData("bash -lc 'ls | head'")
  @TestData("cmd /c 'type a#b | more'")
  public leavesACallItCannotTitleUntitled(command: string): void {
    Assert.isNull(CommandTitleReader.titleOfCall(command));
  }
}
