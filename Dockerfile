ARG baseimage
FROM $baseimage

USER root

# Higher-level port mapped to port 80/443 in OpenShift
EXPOSE 8080
ENV ASPNETCORE_URLS=http://*:8080
ENV ASPNETCORE_HTTP_PORTS=8080

# Flush stdout/stderr line-by-line so startup crashes actually surface in `oc logs`.
ENV DOTNET_CONSOLE_DISABLE_BUFFERING=1
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Egress proxy (Apache/Azure doc: "Setup proxy at pods. Bypass proxy for local url.") is environment
# specific, so HTTP_PROXY/HTTPS_PROXY/NO_PROXY are injected via the Helm values env, not baked here.
# .NET HttpClient.DefaultProxy reads them automatically, so the Ping JWKS fetch honors the proxy + bypass.

WORKDIR /app
ENV PATH=/app:${PATH} HOME=/app

# The Apache image's three .conf files (rewrite / pingheader / rproxy) are translated to code in
# Program.cs + Gateway/, so no httpd config is copied. The SPA + robots.txt the Apache image put under
# /var/www/html are produced into wwwroot by `dotnet publish -c Release` (the Dse.UI .esproj reference
# runs `pnpm build`), so they ride in via the published `app` output below. The publish agent therefore
# needs node + pnpm; pass -p:SkipSpaBuild=true if the SPA is built in a separate pipeline step instead.
COPY uid_entrypoint .
COPY app .

RUN chmod -R u+x /app && \
    chgrp -R 0 /app && \
    chmod -R g=u /app /etc/passwd

USER 10001

# uid_entrypoint resolves the (random) OpenShift UID into /etc/passwd, then exec's
# the dotnet process. Single ENTRYPOINT — having two silently drops the first.
ENTRYPOINT ["uid_entrypoint", "dotnet", "Dse.Api.dll"]
