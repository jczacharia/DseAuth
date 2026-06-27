#:sdk Cake.Sdk@6.2.0

// Cake.Sdk spike — a typed, file-based orchestrator sitting ON TOP of MSBuild (it shells out to
// `dotnet` for the actual compile). Isolated by design: Cake is pinned inline, there is no
// global.json, and nothing else in the repo is touched, so `dotnet build` stays exactly as it was.
// Run from the repo root:  dotnet run build.cs            (runs Default)
//                          dotnet run build.cs -- --target Build --configuration Release
//
// What this proves: Clean -> Build -> Test as a real dependency graph. The genuine payoff lands when
// scripts/sonar-analyze.cs and the Playwright E2E sequencing collapse into tasks here — IsDependentOn
// edges instead of hand-ordered Process calls.

var target = Argument("target", "Default");
var configuration = Argument("configuration", "Debug");

const string solution = "Dse.slnx";

Task("Clean")
    .Does(() =>
    {
        // Typed + cross-platform: no rm -rf, no platform branching.
        CleanDirectories("src/**/bin");
        CleanDirectories("src/**/obj");
    });

Task("Build")
    .IsDependentOn("Clean")
    .Does(() =>
    {
        DotNetBuild(solution, new DotNetBuildSettings { Configuration = configuration });
    });

Task("Test")
    .IsDependentOn("Build")
    .Does(() =>
    {
        // Drives the same `dotnet test` that runs the C# xUnit + Vitest halves; --no-build reuses Build's output.
        DotNetTest(solution, new DotNetTestSettings { Configuration = configuration, NoBuild = true });
    });

Task("Default").IsDependentOn("Test");

// --- SonarQube local analysis (ported from scripts/sonar-analyze.cs) ---------------------------------
// Analyzes the COMMITTED HEAD inside a throwaway .sonar-tmp/ clone, so the fileset matches CI's
// `checkout: self` (no local node_modules/bin/obj/coverage cruft; uncommitted changes are excluded).
// Requires: dotnet-sonarscanner global tool, Java 21+, and SONARQUBE_TOKEN_GLOBAL_ANALYSIS.
//   dotnet run build.cs -- --target Sonar
// The linear script became a graph: Prepare -> Begin -> Build -> Test -> End. The scanner injects its
// MSBuild targets during Build (between Begin and End), so the edges are real ordering, not decoration.

var sonarHostUrl = Env("SONAR_HOST_URL", "http://localhost:9000");
var sonarKey = Env("SONAR_PROJECT_KEY", "ddd");
var sonarVersion = Env("SONAR_PROJECT_VERSION", "2.2.2");
var sonarConfig = Env("SONAR_BUILD_CONFIG", "Release");
var sonarToken = Environment.GetEnvironmentVariable("SONARQUBE_TOKEN_GLOBAL_ANALYSIS");
var cloneDir = ""; // resolved in Sonar-Prepare; shared across the chain (and gates Teardown)

// Project-relative (**/-prefixed); node_modules/coverage/.playwright are regenerated in the clone and
// filesystem-scanned past the bin exclusion; scripts/ holds dev tools, not product code.
const string sonarExclusions =
    "**/obj/**,**/bin/**,**/node_modules/**,**/coverage/**,**/.playwright/**,**/*Tests*.cs,**/*testresult*.xml,**/wwwroot/**,**/*opencover*.xml,**/Program.cs,**/*Dockerfile*,**/quality_engineering/**,**/scripts/**,**/ui/src/app/api/**,**/ui/src/app/ui/**,**/lint-staged.config.mjs";
const string sonarJsExclusions = "**/node_modules/**,**/bin/**,**/.playwright/**,**/coverage/**";
const string sonarTestExclusions = "**/*Tests*.cs,**/*testresult*.xml,**/*opencover*.xml";

Task("Sonar-Prepare")
    .Does(() =>
    {
        if (string.IsNullOrEmpty(sonarToken))
        {
            throw new CakeException("Set SONARQUBE_TOKEN_GLOBAL_ANALYSIS to a SonarQube analysis token");
        }

        var repoRoot = Capture("git", b => b.Append("rev-parse").Append("--show-toplevel"));
        var commit = Capture("git", b => b.Append("rev-parse").Append("HEAD"));
        cloneDir = System.IO.Path.Combine(repoRoot, ".sonar-tmp");

        if (DirectoryExists(cloneDir)) // deterministic: always start from a clean tree
        {
            DeleteDirectory(cloneDir, new DeleteDirectorySettings { Recursive = true, Force = true });
        }

        // Fresh checkout of the committed tree, pinned to the current HEAD commit.
        Exec("git", b => b.Append("clone").Append("--quiet").AppendQuoted(repoRoot).AppendQuoted(cloneDir));
        Exec("git", b => b.Append("-C").AppendQuoted(cloneDir).Append("checkout").Append("--quiet").Append(commit));
    });

Task("Sonar-Begin")
    .IsDependentOn("Sonar-Prepare")
    .Does(() =>
    {
        Exec(
            "dotnet",
            b =>
                b.Append("sonarscanner")
                    .Append("begin")
                    .Append($"/k:{sonarKey}")
                    .Append($"/n:{sonarKey}")
                    .Append($"/v:{sonarVersion}")
                    .Append($"/d:sonar.host.url={sonarHostUrl}")
                    .AppendSecret($"/d:sonar.token={sonarToken}") // redacted in logs + error output by Cake
                    .Append("/d:sonar.scanner.skipJreProvisioning=true")
                    .Append("/d:sonar.scm.disabled=true")
                    .Append("/d:sonar.sourceEncoding=UTF-8")
                    .Append($"/d:sonar.exclusions={sonarExclusions}")
                    // Absolute paths: the .NET scanner resolves relative coverage paths per-module (against the
                    // ui base dir), doubling to ui/ui/... and silently finding nothing. Unit (Vitest) + E2E
                    // (Playwright) lcov are unioned per line by Sonar.
                    .Append($"/d:sonar.javascript.lcov.reportPaths={Coverage("lcov.info")},{Coverage("e2e", "lcov.info")}")
                    .Append($"/d:sonar.testExecutionReportPaths={Coverage("ut_report.xml")}")
                    .Append($"/d:sonar.javascript.exclusions={sonarJsExclusions}")
                    .Append($"/d:sonar.coverage.exclusions={sonarTestExclusions}")
                    .Append($"/d:sonar.test.exclusions={sonarTestExclusions}")
                    .Append("/d:sonar.cs.opencover.reportsPaths=**/coverage.opencover.xml")
                    .Append("/d:sonar.cs.vstest.reportsPaths=**/*.trx"),
            cloneDir
        );
    });

Task("Sonar-Build")
    .IsDependentOn("Sonar-Begin")
    .Does(() =>
    {
        // Release matches CI and lets Dse.Api's Release-only BuildSpa target provision the SPA in the
        // fresh clone — without it the Vitest half of `dotnet test` has no node_modules.
        DotNetBuild(solution, new DotNetBuildSettings { Configuration = sonarConfig, WorkingDirectory = cloneDir });
    });

Task("Sonar-Test")
    .IsDependentOn("Sonar-Build")
    .Does(() =>
    {
        DotNetTest(
            solution,
            new DotNetTestSettings
            {
                Configuration = sonarConfig,
                NoBuild = true,
                WorkingDirectory = cloneDir,
                Loggers = { "trx" },
                ArgumentCustomization = args =>
                    args.Append("/p:CollectCoverage=true").Append("/p:CoverletOutputFormat=opencover"),
            }
        );
    });

Task("Sonar-End")
    .IsDependentOn("Sonar-Test")
    .Does(() =>
    {
        Exec("dotnet", b => b.Append("sonarscanner").Append("end").AppendSecret($"/d:sonar.token={sonarToken}"), cloneDir);
        Information($"Analysis submitted: {sonarHostUrl}/dashboard?id={sonarKey}");
    });

Task("Sonar")
    .IsDependentOn("Sonar-End")
    .Description("Local SonarQube analysis of committed HEAD in a throwaway .sonar-tmp/ clone");

// Implements the original's documented-but-unwired intent: remove the throwaway clone after the run
// (SONAR_KEEP_CLONE=1 keeps it). Runs even on failure; no-ops for non-Sonar targets (cloneDir is empty).
Teardown(_ =>
{
    if (
        cloneDir is { Length: > 0 }
        && DirectoryExists(cloneDir)
        && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SONAR_KEEP_CLONE"))
    )
    {
        DeleteDirectory(cloneDir, new DeleteDirectorySettings { Recursive = true, Force = true });
    }
});

static string Env(string key, string fallback) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : fallback;

string Coverage(params string[] parts) => System.IO.Path.Combine([cloneDir, "ui", "coverage", .. parts]);

// Cake's ProcessArgumentBuilder + RenderSafe() supersede the original's hand-rolled secret-truncation:
// secret-marked args are redacted everywhere, so the full (safe) command line can appear in errors.
string Capture(string tool, Action<ProcessArgumentBuilder> build)
{
    var args = new ProcessArgumentBuilder();
    build(args);
    var exit = StartProcess(tool, new ProcessSettings { Arguments = args, RedirectStandardOutput = true }, out var stdout);
    if (exit != 0)
    {
        throw new CakeException($"`{tool} {args.RenderSafe()}` exited {exit}");
    }

    return string.Join('\n', stdout).Trim();
}

void Exec(string tool, Action<ProcessArgumentBuilder> build, string? cwd = null)
{
    var args = new ProcessArgumentBuilder();
    build(args);
    var settings = new ProcessSettings { Arguments = args };
    if (cwd is not null)
    {
        settings.WorkingDirectory = cwd;
    }

    var exit = StartProcess(tool, settings);
    if (exit != 0)
    {
        throw new CakeException($"`{tool} {args.RenderSafe()}` exited {exit}");
    }
}

RunTarget(target);
