#!/usr/bin/env python3
"""Expand a local azure-pipelines.yml into its fully-resolved form — no commit, no pipeline run.

Inner loop for editing pipeline values: this POSTs your *local* YAML to Azure DevOps' pipeline
`preview` endpoint with `previewRun=true` (compile only, nothing is queued) and `yamlOverride` (use
the bytes on disk instead of the committed file). ADO still resolves `resources.repositories`
server-side, so your edits compile against the *real* enterprise templates and the response's
`finalYaml` is the expanded pipeline_dotnet.yml — the same artifact a real run would produce.

Runs where you HAVE connectivity to *.pncint.net (this repo's dev box is air-gapped from it).
Read-only: preview never mutates ADO state. Stdlib only.

Auth:
  ADO_PAT   Azure DevOps PAT (basic auth, empty username). Also reads AZURE_DEVOPS_EXT_PAT.

The pipeline --id (or --name) must be a real pipeline authorized for the template repo's service
connection (your searchapi pipeline) — that's whose identity resolves `enterprise_pnc_automation`.
Find it in tfd_probe.py output (proj_pipelines.json) or pass --name to resolve it here.

Quick start (on the connected box):
  export ADO_PAT=xxxx
  python3 expand-pipeline.py --collection <COLLECTION> --project <DSE_PROJECT> --name searchapi --insecure
  python3 expand-pipeline.py --collection <COLLECTION> --project <DSE_PROJECT> --id 42 -o - --insecure | less
  python3 expand-pipeline.py ... --dry-run        # print the request, make no call
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_HOST = "https://tfd.pncint.net"  # prod; QA = https://tfd-qa.pncint.net
DEFAULT_API = "7.1-preview.1"  # ADO Server 2022.2; use 6.0-preview.1 for 2020


def opener(insecure: bool, cacert: str | None, no_proxy: bool) -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context(cafile=cacert) if cacert else ssl.create_default_context()
    if insecure:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    proxy = urllib.request.ProxyHandler({}) if no_proxy else urllib.request.ProxyHandler()
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), proxy)


def ado_headers(pat: str) -> dict:
    return {"Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode(),
            "Accept": "application/json"}


def request(op, method, url, headers, body=None, timeout=60):
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with op.open(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def resolve_id_by_name(op, base, proj, api, headers, name) -> int:
    status, raw = request(op, "GET", f"{base}/{proj}/_apis/pipelines?api-version={api}", headers)
    if status != 200:
        sys.exit(f"!! pipeline list failed (HTTP {status}); pass --id explicitly.\n{raw[:2000].decode(errors='replace')}")
    items = json.loads(raw).get("value", [])
    matches = [p for p in items if p.get("name", "").lower() == name.lower()]
    if not matches:
        names = ", ".join(sorted(p.get("name", "?") for p in items)) or "(none)"
        sys.exit(f"!! no pipeline named '{name}'. Available: {names}")
    return matches[0]["id"]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Expand local azure-pipelines.yml via ADO preview (no run).")
    ap.add_argument("file", nargs="?", default="azure-pipelines.yml",
                    help="local entry YAML to expand (default: azure-pipelines.yml).")
    ap.add_argument("--ado-host", default=os.environ.get("ADO_HOST", DEFAULT_HOST),
                    help=f"default prod={DEFAULT_HOST}; QA=https://tfd-qa.pncint.net")
    ap.add_argument("--collection", default=os.environ.get("ADO_COLLECTION", ""),
                    help="collection segment in the ADO Server URL path (from $(System.CollectionUri)).")
    ap.add_argument("--project", default=os.environ.get("ADO_PROJECT", ""),
                    help="team project that owns the pipeline (e.g. the DSE project, NOT the templates project).")
    ap.add_argument("--id", type=int, help="pipeline id to borrow service-connection context from.")
    ap.add_argument("--name", help="resolve pipeline id by name instead of --id (e.g. searchapi).")
    ap.add_argument("--api-version", default=os.environ.get("ADO_API_VERSION", DEFAULT_API))
    ap.add_argument("-o", "--out", default=None,
                    help="write finalYaml here ('-' = stdout; default: <file>.expanded.yml).")
    ap.add_argument("--insecure", action="store_true", help="skip TLS verification (internal CA).")
    ap.add_argument("--cacert", default=os.environ.get("SSL_CERT_FILE"), help="internal CA bundle path.")
    ap.add_argument("--no-proxy", action="store_true", help="ignore HTTP(S)_PROXY (direct to internal hosts).")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true", help="print the request, make no call.")
    args = ap.parse_args(argv)

    src = Path(args.file)
    if not src.is_file():
        sys.exit(f"!! not found: {src}")
    yaml_text = src.read_text()

    base = f"{args.ado_host.rstrip('/')}/{args.collection.strip('/')}" if args.collection else args.ado_host.rstrip("/")
    proj = urllib.parse.quote(args.project)

    if args.dry_run:
        pid = args.id or f"<resolve '{args.name}'>"
        print(f"POST {base}/{proj}/_apis/pipelines/{pid}/preview?api-version={args.api_version}")
        print(f"body: previewRun=true, yamlOverride=<{len(yaml_text)} bytes from {src}>")
        return 0

    if not args.collection or not args.project:
        sys.exit("!! --collection and --project are required for a live call (see --help).")
    pat = os.environ.get("ADO_PAT") or os.environ.get("AZURE_DEVOPS_EXT_PAT")
    if not pat:
        sys.exit("!! ADO_PAT not set.")
    if not args.id and not args.name:
        sys.exit("!! pass --id or --name.")

    op = opener(args.insecure, args.cacert, args.no_proxy)
    headers = ado_headers(pat)
    pid = args.id or resolve_id_by_name(op, base, proj, args.api_version, headers, args.name)

    url = f"{base}/{proj}/_apis/pipelines/{pid}/preview?api-version={args.api_version}"
    body = json.dumps({"previewRun": True, "yamlOverride": yaml_text}).encode()
    status, raw = request(op, "POST", url, {**headers, "Content-Type": "application/json"}, body, args.timeout)

    # ADO returns 400 with a structured compile error when the YAML/templates don't compile — that
    # diagnostic IS the point on a bad edit, so surface it verbatim.
    try:
        data = json.loads(raw)
    except Exception:
        data = None
    if status != 200 or not isinstance(data, dict):
        msg = (data or {}).get("message") if isinstance(data, dict) else raw[:4000].decode(errors="replace")
        sys.exit(f"!! preview failed (HTTP {status}) for pipeline {pid}:\n{msg}")

    final = data.get("finalYaml")
    if not final:
        sys.exit(f"!! no finalYaml in response:\n{json.dumps(data, indent=2)[:4000]}")

    if args.out == "-":
        sys.stdout.write(final)
        return 0
    dest = Path(args.out) if args.out else src.with_suffix(".expanded.yml")
    dest.write_text(final)
    print(f"-> {dest} ({len(final)} bytes, pipeline {pid})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
