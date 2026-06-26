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
        if (!_allowedEndpoints.Contains(request.Endpoint))
        {
            throw new UnauthorizedAccessException($"Unauthorized SonarQube API endpoint: {request.Endpoint}");
        }

        string url = $"{request.Endpoint}?{request.Query}";
        var message = new HttpRequestMessage(HttpMethod.Get, url);
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
}
