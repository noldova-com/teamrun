/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ShellDialect, ShellTokenKind, ShellTokenReader } from "@noldova/teamrun.providers";

@TestClass
export class ShellTokenReaderTests {
  @TestMethod
  @TestData("echo 'a b' \"c $d\" e\\ f", "W:echo, W:a b, W?:c $d, W:e f")
  @TestData("a && b || c; d | e & f", "W:a, S:&&, W:b, S:||, W:c, S:;, W:d, S:|, W:e, S:&, W:f")
  @TestData("cmd 2>&1 >out 2>>err &>all <in", "W:cmd, R:>&, W:1, R:>, W:out, R:>>, W:err, R:&>, W:all, R:<, W:in")
  @TestData("cmd 2>&1>out", "W:cmd, R:>&, W:1, R:>, W:out")
  @TestData("echo $(date) `pwd` ${x} *.txt {a,b} <(ls)", "W:echo, W?:$(date), W?:`pwd`, W?:${x}, W?:*.txt, W?:{a,b}, W?:<(ls)")
  @TestData("echo \"$(cd ')'; ls)\" $((1 + (2)))", "W:echo, W?:$(cd ')'; ls), W?:$((1 + (2)))")
  @TestData("(cd x) { y; }", "O:(, W:cd, W:x, C:), W:{, W:y, S:;, W:}")
  @TestData("echo a # b > c", "W:echo, W:a")
  @TestData("echo a # b\nc", "W:echo, W:a, S:\\n, W:c")
  @TestData("echo \"a\\\"b\\$c\\\\d\\e\"", "W:echo, W:a\"b$c\\d\\e")
  @TestData("echo \"a `pwd` b\" $(a \\))", "W:echo, W?:a `pwd` b, W?:$(a \\))")
  @TestData("echo a#b", "W:echo, W:a#b")
  @TestData("cat <<-EOF > f\n\tbody > g\n\tEOF\necho", "W:cat, R:<<-, W:EOF, R:>, W:f, S:\\n, W:echo")
  @TestData("cat <<'EOF'\nEOF", "W:cat, R:<<, W:EOF, S:\\n")
  @TestData("a2>f \"2\">g", "W:a2, R:>, W:f, W:2, R:>, W:g")
  @TestData("a \\\nb", "W:a, W:b")
  @TestData("a\r\nb", "W:a, S:\\n, W:b")
  @TestData("touch \"~/x\" '~'/y \\~z ~/w a\"~\"", "W:touch, W:./~/x, W:./~/y, W:./~z, W:~/w, W:a~")
  public splitsAPosixScript(script: string, expected: string): void {
    Assert.areEqual(expected, ShellTokenReaderTests.render(script, ShellDialect.Posix));
  }

  @TestMethod
  @TestData("Write-Output 'it''s' \"a\"\"b\" C:\\x\\y", "W:Write-Output, W:it's, W:a\"b, W:C:\\x\\y")
  @TestData("Write-Output @{a=1}", "W:Write-Output, W?:@{a=1}")
  @TestData("Get-Item $env:TEMP, \"$x\" @args (Get-Date) {x} @(1)", "W:Get-Item, W?:$env:TEMP,$x, W?:@args, W?:(Get-Date), W?:{x}, W?:@(1)")
  @TestData("Copy-Item a,b C:\\out", "W:Copy-Item, W?:a,b, W:C:\\out")
  @TestData("a *> b 2>&1 >> c", "W:a, R:>, W:b, R:>&, W:1, R:>>, W:c")
  @TestData("a; b && c || d | e", "W:a, S:;, W:b, S:&&, W:c, S:||, W:d, S:|, W:e")
  @TestData("a # x", "W:a")
  @TestData("<# c #> b", "W:b")
  @TestData("a` b \"c`\"d\"", "W:a b, W:c\"d")
  @TestData("sc \"~/x\" y", "W:sc, W:~/x, W:y")
  public splitsAPowerShellScript(script: string, expected: string): void {
    Assert.areEqual(expected, ShellTokenReaderTests.render(script, ShellDialect.PowerShell));
  }

  @TestMethod
  @TestData("echo \"a b\" ^& c %X% x*", "W:echo, W:a b, W:&, W:c, W?:%X%, W?:x*")
  @TestData("a&&b||c&d|e (f) 2>&1>nul", "W:a, S:&&, W:b, S:||, W:c, S:&, W:d, S:|, W:e, O:(, W:f, C:), R:>&, W:1, R:>, W:nul")
  @TestData("echo # x", "W:echo, W:#, W:x")
  public splitsACmdScript(script: string, expected: string): void {
    Assert.areEqual(expected, ShellTokenReaderTests.render(script, ShellDialect.Cmd));
  }

  @TestMethod
  @TestData("echo $(a) `b` <(c) $((1 + 2)) \"$(d)\" ${e} $f '$(g)' x", ShellDialect.Posix, "1,1,1,1,1,0,0,0,0")
  @TestData("echo (a) $(b) @(c) @{d=1} {e} \"$(f)\" ${g} $h @i '$(j)' x", ShellDialect.PowerShell, "1,1,1,1,1,1,0,0,0,0,0")
  @TestData("echo %a% \"b\" x", ShellDialect.Cmd, "0,0,0")
  @TestData("echo ${a:-$(b)} \"${c:-`d`}\" ${e:-f} x", ShellDialect.Posix, "1,1,0,0")
  public marksTheWordsWhoseExpansionRunsCode(script: string, dialect: ShellDialect, expected: string): void {
    const tokens = ShellTokenReader.tokensOf(script, dialect);

    Assert.areEqual(expected, (tokens ?? []).slice(1).map(t => t.runsCommands ? "1" : "0").join(","));
  }

  @TestMethod
  @TestData("cat <<EOF\n$(rm x)\nEOF", "1")
  @TestData("cat <<-EOF\n\t`rm x`\n\tEOF", "1")
  @TestData("cat <<'EOF'\n$(rm x)\nEOF", "0")
  @TestData("cat <<\\EOF\n$(rm x)\nEOF", "0")
  @TestData("cat <<EOF\n$x\nEOF", "0")
  public marksAHereDocumentsDelimiterWhenItsUnquotedBodyRunsCommands(script: string, expected: string): void {
    const tokens = ShellTokenReader.tokensOf(script, ShellDialect.Posix);

    Assert.areEqual(`W:EOF:${expected}`, (tokens ?? []).slice(2, 3).map(t => `W:${t.text}:${t.runsCommands ? "1" : "0"}`).join(","));
  }

  @TestMethod
  public keepsAPowerShellCommaListsItemsInItsWord(): void {
    const tokens = ShellTokenReader.tokensOf("rm a, 'b c',$d e", ShellDialect.PowerShell);

    Assert.areEqual("a,b c,$d", tokens?.[1]?.text);
    Assert.areEqual("a:1|b c:1|$d:0", (tokens?.[1]?.items ?? []).map(t => `${t.text}:${t.isLiteral ? 1 : 0}`).join("|"));
    Assert.areEqual(0, tokens?.[2]?.items.length);
  }

  @TestMethod
  @TestData("echo 'x", ShellDialect.Posix)
  @TestData("echo \"x", ShellDialect.Posix)
  @TestData("echo $(x", ShellDialect.Posix)
  @TestData("echo `x", ShellDialect.Posix)
  @TestData("echo \"$(a\"", ShellDialect.Posix)
  @TestData("echo \"`pwd\"", ShellDialect.Posix)
  @TestData("echo \\", ShellDialect.Posix)
  @TestData("cat <<EOF\nx", ShellDialect.Posix)
  @TestData("cat <<EOF", ShellDialect.Posix)
  @TestData("cat <<\nx", ShellDialect.Posix)
  @TestData("a < b", ShellDialect.PowerShell)
  @TestData("cmd --% x", ShellDialect.PowerShell)
  @TestData("a )", ShellDialect.PowerShell)
  @TestData("'x", ShellDialect.PowerShell)
  @TestData("<# x", ShellDialect.PowerShell)
  @TestData("echo \"x", ShellDialect.Cmd)
  public refusesWhatItCannotSplit(script: string, dialect: ShellDialect): void {
    Assert.isNull(ShellTokenReader.tokensOf(script, dialect));
  }

  private static render(script: string, dialect: ShellDialect): string {
    const letters = new Map([[ShellTokenKind.Word, "W"], [ShellTokenKind.Separator, "S"], [ShellTokenKind.Redirect, "R"], [ShellTokenKind.Open, "O"],
      [ShellTokenKind.Close, "C"]]);
    const tokens = ShellTokenReader.tokensOf(script, dialect);
    Assert.isNotNull(tokens);
    return (tokens ?? []).map(t => `${letters.get(t.kind) as string}${t.isLiteral ? "" : "?"}:${t.text.replaceAll("\n", "\\n")}`).join(", ");
  }
}
