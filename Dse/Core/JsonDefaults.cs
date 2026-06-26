// Copyright (c) PNC Financial Services. All rights reserved.

using System.Text.Json;

namespace Dse.Core;

public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static readonly JsonSerializerOptions Pretty = new(JsonSerializerDefaults.Web) { WriteIndented = true };
}
