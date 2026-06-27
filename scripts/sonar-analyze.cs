// Local SonarQube analysis of the committed HEAD against a developer instance.
//
// Clones HEAD into a throwaway .sonar-tmp/ (mirrors CI's `checkout: self`, so the analyzed file set
// matches the pipeline — no local node_modules/bin/obj/coverage cruft; uncommitted changes are NOT
// analyzed). The clone is wiped before every run and removed afterward (SONAR_KEEP_CLONE=1 keeps it).
// Release matches CI and is required for Dse.Api's BuildSpa target (Release-only) to provision the SPA
// in the fresh clone, without which the Vitest half of `dotnet test` has no node_modules.
//
// Requires: dotnet-sonarscanner (global tool), Java 21+, and an analysis token in
// SONARQUBE_TOKEN_GLOBAL_ANALYSIS. Override SONAR_HOST_URL to target a different server.
//
// .NET 10 file-based app — run from the repo root via `npm run sonar:analyze`
// (or `dotnet run --file scripts/sonar-analyze.cs`).

using System.Diagnostics;

static string Env(string key, string fallback) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : fallback;

var token = Environment.GetEnvironmentVariable("SONARQUBE_TOKEN_GLOBAL_ANALYSIS");
if (string.IsNullOrEmpty(token))
{
    Console.Error.WriteLine("!! Set SONARQUBE_TOKEN_GLOBAL_ANALYSIS to a SonarQube analysis token");
    return 1;
}

var hostUrl = Env("SONAR_HOST_URL", "http://localhost:9000");
var key = Env("SONAR_PROJECT_KEY", "dse");
var version = Env("SONAR_PROJECT_VERSION", "2.2.2");
var config = Env("SONAR_BUILD_CONFIG", "Release");

// Project-relative (**/-prefixed); module-relative patterns are deprecated. node_modules/coverage/
// .playwright are regenerated inside the clone (JS/HTML sensors filesystem-scan past the bin exclusion);
// scripts/ holds these file-based dev tools, not product code. Keep analysis to real source.
const string exclusions =
    "**/obj/**,**/bin/**,**/node_modules/**,**/coverage/**,**/.playwright/**,**/*.bin,**/*Tests*.cs,**/*testresult*.xml,**/*opencover*.xml,**/Program.cs,**/*Dockerfile*,**/quality_engineering/**,**/scripts/**,**/Dse.UI/src/app/api/**,**/Dse.UI/src/app/ui/**";
const string jsExclusions = "**/node_modules/**,**/bin/**,**/.playwright/**,**/coverage/**";
const string testExclusions = "**/*Tests*.cs,**/*testresult*.xml,**/*opencover*.xml";

var repoRoot = Capture("git", "rev-parse", "--show-toplevel");
var commit = Capture("git", "rev-parse", "HEAD");
var cloneDir = Path.Combine(repoRoot, ".sonar-tmp");

if (Directory.Exists(cloneDir))
    Directory.Delete(cloneDir, recursive: true); // deterministic
try
{
    // Fresh checkout of the committed tree, pinned to the current HEAD commit.
    Run("git", ["clone", "--quiet", repoRoot, cloneDir]);
    Run("git", ["-C", cloneDir, "checkout", "--quiet", commit]);
    Run(
        "dotnet",
        [
            "sonarscanner",
            "begin",
            $"/k:{key}",
            $"/n:{key}",
            $"/v:{version}",
            $"/d:sonar.host.url={hostUrl}",
            $"/d:sonar.token={token}",
            "/d:sonar.scanner.skipJreProvisioning=true",
            "/d:sonar.scm.disabled=true",
            "/d:sonar.sourceEncoding=UTF-8",
            $"/d:sonar.exclusions={exclusions}",
            "/d:sonar.typescript.tsconfigPaths=Dse.UI/tsconfig.json",
            "/d:sonar.javascript.lcov.reportPaths=Dse.UI/coverage/lcov.info",
            $"/d:sonar.javascript.exclusions={jsExclusions}",
            $"/d:sonar.coverage.exclusions={testExclusions}",
            $"/d:sonar.test.exclusions={testExclusions}",
            "/d:sonar.cs.opencover.reportsPaths=**/coverage.opencover.xml",
            "/d:sonar.cs.vstest.reportsPaths=**/*.trx",
        ],
        cloneDir
    );

    Run("dotnet", ["build", "Dse.slnx", "-c", config], cloneDir);
    Run(
        "dotnet",
        [
            "test",
            "Dse.slnx",
            "-c",
            config,
            "--no-build",
            "--logger",
            "trx",
            "/p:CollectCoverage=true",
            "/p:CoverletOutputFormat=opencover",
        ],
        cloneDir
    );
    Run("dotnet", ["sonarscanner", "end", $"/d:sonar.token={token}"], cloneDir);

    Console.WriteLine($"Analysis submitted: {hostUrl}/dashboard?id={key}");
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"!! {e.Message}");
    return 1;
}

static string Capture(string file, params string[] args)
{
    var psi = new ProcessStartInfo(file) { UseShellExecute = false, RedirectStandardOutput = true };
    foreach (var a in args)
        psi.ArgumentList.Add(a);
    using var p = Process.Start(psi) ?? throw new InvalidOperationException($"could not start {file}");
    var stdout = p.StandardOutput.ReadToEnd();
    p.WaitForExit();
    if (p.ExitCode != 0)
        throw new InvalidOperationException(Failure(file, args, p.ExitCode));
    return stdout.Trim();
}

static void Run(string file, string[] args, string? cwd = null)
{
    var psi = new ProcessStartInfo(file) { UseShellExecute = false };
    if (cwd is not null)
        psi.WorkingDirectory = cwd;
    foreach (var a in args)
        psi.ArgumentList.Add(a);
    using var p = Process.Start(psi) ?? throw new InvalidOperationException($"could not start {file}");
    p.WaitForExit();
    if (p.ExitCode != 0)
        throw new InvalidOperationException(Failure(file, args, p.ExitCode));
}

// Only the leading args (never the token, which trails) — keeps secrets out of error output.
static string Failure(string file, string[] args, int code) => $"`{file} {string.Join(' ', args.Take(3))} …` exited {code}";
