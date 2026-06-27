// Copyright (c) PNC Financial Services. All rights reserved.

using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Dse.Extensions;

public static class ProblemDetailsExtensions
{
    public const string HttpContextKey = "SetProblemDetails";

    private static string BuildExceptionChainMessage(Exception ex)
    {
        StringBuilder message = new($"{ex.GetType().Name}: {ex.Message} {ex.StackTrace}");
        for (Exception? inner = ex.InnerException; inner is not null; inner = inner.InnerException)
        {
            message.Append(CultureInfo.InvariantCulture, $" {inner.Message}");
        }

        return message.ToString();
    }

    extension(ProblemDetailsOptions setup)
    {
        public void ApplyCoreCustomization() =>
            setup.CustomizeProblemDetails = context =>
            {
                if (TryApplyPresetProblem(context))
                {
                    return;
                }

                if (context.Exception is { } ex)
                {
                    ApplyExceptionDetail(context, ex);
                    return;
                }

                if (context.ProblemDetails is HttpValidationProblemDetails h)
                {
                    h.Errors = h.Errors.ToDictionary(x => x.Key, x => x.Value);
                }
                else if (context.ProblemDetails is ValidationProblemDetails v)
                {
                    v.Errors = v.Errors.ToDictionary(x => x.Key, x => x.Value);
                }

                if (context.ProblemDetails.Detail is not null)
                {
                    return;
                }

                ApplyNotFoundDetail(context);
            };
    }

    private static bool TryApplyPresetProblem(ProblemDetailsContext context)
    {
        if (context.HttpContext.Items[HttpContextKey] is not ProblemDetails setProblem)
        {
            return false;
        }

        context.ProblemDetails = setProblem;
        if (setProblem.Status is { } status && !context.HttpContext.Response.HasStarted)
        {
            context.HttpContext.Response.StatusCode = status;
        }

        return true;
    }

    private static void ApplyExceptionDetail(ProblemDetailsContext context, Exception ex)
    {
        context.ProblemDetails.Detail = context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsProduction()
            ? "An exception occurred while processing your request."
                + " Please try again later or contact the DSE team if the problem persists."
            : BuildExceptionChainMessage(ex);
    }

    private static void ApplyNotFoundDetail(ProblemDetailsContext context)
    {
        if (context.HttpContext.Response is not { StatusCode: StatusCodes.Status404NotFound, HasStarted: false })
        {
            return;
        }

        context.ProblemDetails.Detail = "The requested resource was not found.";
        context.ProblemDetails.Extensions["Path"] = context.HttpContext.Request.Path;
    }

    extension(HttpContext httpContext)
    {
        public void SetProblem(ProblemDetails problem) => httpContext.Items[HttpContextKey] = problem;

        public void SetProblem(HttpStatusCode statusCode, string title, string detail) =>
            httpContext.SetProblem(httpContext.CreateProblem(statusCode, title, detail));

        public ProblemDetails CreateProblem(HttpStatusCode statusCode, string title, string detail) =>
            httpContext
                .RequestServices.GetRequiredService<ProblemDetailsFactory>()
                .CreateProblemDetails(httpContext, (int)statusCode, title, detail: detail);

        public ProblemHttpResult ProblemHttpResult(HttpStatusCode statusCode, string title, string detail) =>
            TypedResults.Problem(httpContext.CreateProblem(statusCode, title, detail));
    }
}
