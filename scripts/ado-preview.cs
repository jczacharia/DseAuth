// Expand the local azure-pipelines.yml via ADO's pipeline `preview` endpoint — no commit, no run.
// previewRun:true = compile only (nothing queued); yamlOverride = use the file on disk instead of the
// committed one, so local edits compile against the real server-side enterprise templates. Writes the
// returned finalYaml into the gitignored .ado-preview/. Needs ADO_PAT.
//
// .NET 10 file-based app — run from the repo root via `npm run ado:ci:preview`
// (or `dotnet run --file scripts/ado-preview.cs`).

using System.Text;
using System.Text.Json;

static string Env(string key, string fallback) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : fallback;

var pat = Environment.GetEnvironmentVariable("ADO_PAT");
if (string.IsNullOrEmpty(pat))
{
    Console.Error.WriteLine("!! ADO_PAT not set");
    return 1;
}

var host = Env("ADO_HOST", "https://tfd.pncint.net");
var collection = Env("ADO_COLLECTION", "SharedCollection01");
var project = Env("ADO_PROJECT", "DSE - Discoverability");
var pipelineId = Env("ADO_PIPELINE_ID", "3030");
var api = Env("ADO_API_VERSION", "7.1-preview.1");

var root = Directory.GetCurrentDirectory();
var pipelineFile = Path.Combine(root, "azure-pipelines.yml");
if (!File.Exists(pipelineFile))
{
    Console.Error.WriteLine($"!! azure-pipelines.yml not found in {root} (run from the repo root)");
    return 1;
}
var yamlOverride = await File.ReadAllTextAsync(pipelineFile);
var url = $"{host}/{collection}/{Uri.EscapeDataString(project)}/_apis/pipelines/{pipelineId}/preview?api-version={api}";

// Internal corp CA: tfd.pncint.net isn't in the default trust store, so bypass validation (the browser
// trusts the corp root). Scoped to this one-shot client.
using var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = static (_, _, _, _) => true };
using var http = new HttpClient(handler);
http.DefaultRequestHeaders.Add("Authorization", "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes($":{pat}")));

// Hand-write the body with Utf8JsonWriter — reflection-free, so it stays AOT/trim-clean (file-based
// apps enable the AOT analyzers by default).
string body;
using (var buffer = new MemoryStream())
{
    using (var writer = new Utf8JsonWriter(buffer))
    {
        writer.WriteStartObject();
        writer.WriteBoolean("previewRun", true);
        writer.WriteString("yamlOverride", yamlOverride);
        writer.WriteEndObject();
    }
    body = Encoding.UTF8.GetString(buffer.ToArray());
}

HttpResponseMessage res;
try
{
    res = await http.PostAsync(url, new StringContent(body, Encoding.UTF8, "application/json"));
}
catch (HttpRequestException e)
{
    Console.Error.WriteLine($"!! request failed: {e.Message}");
    return 1;
}

var payload = await res.Content.ReadAsStringAsync();
JsonElement json;
try
{
    json = JsonDocument.Parse(payload).RootElement;
}
catch (JsonException)
{
    // Non-JSON (e.g. a 203 sign-in page when the PAT is rejected) — show status and a snippet.
    Console.Error.WriteLine($"!! unexpected response (HTTP {(int)res.StatusCode})\n{payload[..Math.Min(payload.Length, 2000)]}");
    return 1;
}

// A bad edit returns HTTP 400 with the compile error — that diagnostic is the point, so surface it.
if (!res.IsSuccessStatusCode || !json.TryGetProperty("finalYaml", out var finalYaml))
{
    var message = json.TryGetProperty("message", out var m) ? m.GetString() : payload;
    Console.Error.WriteLine($"!! preview failed (HTTP {(int)res.StatusCode})\n{message}");
    return 1;
}

var outDir = Path.Combine(root, ".ado-preview");
Directory.CreateDirectory(outDir);
var outFile = Path.Combine(outDir, "azure-pipelines.expanded.yml");
var expanded = finalYaml.GetString() ?? "";
await File.WriteAllTextAsync(outFile, expanded);
Console.WriteLine($"-> {outFile} ({expanded.Length} bytes)");
return 0;
