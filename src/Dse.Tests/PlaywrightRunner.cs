// Copyright (c) PNC Financial Services. All rights reserved.

using System.Diagnostics;

namespace Dse.Tests;

// Bridges .NET orchestration to the TypeScript Playwright suite: .NET hosts the app and seeds
// Elasticsearch, then runs one scenario (selected by @tag) against that live URL.
public static class PlaywrightRunner
{
    public static async Task<int> RunAsync(string scenarioTag, string baseUrl, ITestOutputHelper output)
    {
        ProcessStartInfo psi = Npx("playwright", "test", "--grep", scenarioTag);
        psi.Environment["BASE_URL"] = baseUrl;

        using Process process = Process.Start(psi) ?? throw new InvalidOperationException("could not start `npx playwright`");
        process.OutputDataReceived += (_, e) => Forward(output, e.Data);
        process.ErrorDataReceived += (_, e) => Forward(output, e.Data);
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync();
        return process.ExitCode;
    }

    private static ProcessStartInfo Npx(params string[] args)
    {
        var psi = new ProcessStartInfo("npx")
        {
            WorkingDirectory = SpaRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (string arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        return psi;
    }

    private static void Forward(ITestOutputHelper output, string? line)
    {
        if (line is not null)
        {
            output.WriteLine(line);
        }
    }

    private static string SpaRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "Dse.UI")))
        {
            dir = dir.Parent;
        }

        return dir is null
            ? throw new DirectoryNotFoundException("Dse.UI not found above the test output directory")
            : Path.Combine(dir.FullName, "Dse.UI");
    }
}
