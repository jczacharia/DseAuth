// Copyright (c) PNC Financial Services. All rights reserved.

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Dse.Confluence;

public class SonarConfig
{
    public string SonarUri { get; set; } = string.Empty;
    public string SonarToken { get; set; } = string.Empty;
    public string SonarAllowedEndpoints { get; set; } = string.Empty;
}

public sealed record SonarGetRequest(string Endpoint, string Query);

public class SonarHttpClient
{
    private readonly HashSet<string> _allowedEndpoints = [];
    private readonly HttpClient _httpClient;
    private readonly ILogger<SonarHttpClient> _logger;

    public SonarHttpClient(HttpClient httpClient, IOptions<SonarConfig> config, ILogger<SonarHttpClient> logger)
    {
        _httpClient = httpClient;
        SonarConfig config1 = config.Value;
        _logger = logger;

        foreach (string endpoint in config1.SonarAllowedEndpoints.Split(","))
        {
            _allowedEndpoints.Add(endpoint.Trim());
        }
    }

    public async Task<object> Get(SonarGetRequest request)
    {
        // Use the value stored in the allowlist, not the request copy, so the path is provably config-sourced.
        if (!_allowedEndpoints.TryGetValue(request.Endpoint, out string? endpoint))
        {
            throw new UnauthorizedAccessException($"Unauthorized SonarQube API endpoint: {request.Endpoint}");
        }

        string query = NormalizeQuery(request.Query);
        string url = query.Length == 0 ? endpoint : $"{endpoint}?{query}";
        var message = new HttpRequestMessage(HttpMethod.Get, new Uri(url, UriKind.Relative));
        using HttpResponseMessage response = await _httpClient.SendAsync(message);

        string str = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            string? reasonPhrase = string.IsNullOrWhiteSpace(response.ReasonPhrase) ? "error occured" : response.ReasonPhrase;
            _logger.LogError(
                "SonarQube {Url} Request Failed:\nResponse: {ResponseString}\nReason Phrase: {ReasonPhrase}\nStatus Code: {StatusCode}",
                url,
                str,
                reasonPhrase,
                response.StatusCode
            );
            throw new InvalidOperationException(
                $"SonarQube {url} request failed: {str} reason phrase: {reasonPhrase} status code: {response.StatusCode}"
            );
        }

        if (string.IsNullOrWhiteSpace(str))
        {
            throw new InvalidOperationException($"SonarQube {url} empty response");
        }

        object json;
        try
        {
            json =
                JsonSerializer.Deserialize<object>(str)
                ?? throw new InvalidOperationException($"SonarQube {url} empty object response");
        }
        catch (Exception)
        {
            throw new InvalidOperationException($"SonarQube {url} json parse failed");
        }

        return json;
    }

    // Re-encode each query component so user-supplied data can't smuggle path/fragment characters into the URL.
    private static string NormalizeQuery(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return string.Empty;
        }

        IEnumerable<string> pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries).Select(pair =>
        {
            int separator = pair.IndexOf('=', StringComparison.Ordinal);
            if (separator < 0)
            {
                return Uri.EscapeDataString(Uri.UnescapeDataString(pair));
            }

            string key = Uri.EscapeDataString(Uri.UnescapeDataString(pair[..separator]));
            string value = Uri.EscapeDataString(Uri.UnescapeDataString(pair[(separator + 1)..]));
            return $"{key}={value}";
        });

        return string.Join('&', pairs);
    }
}
