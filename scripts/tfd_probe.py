#!/usr/bin/env python3
"""Read-only reconnaissance probe for the PNC ADO / Artifactory / Sonar / registry ecosystem.

Run this where you HAVE connectivity to *.pncint.net (the dev box this repo lives on is air-gapped
from it). Everything here is a GET except the optional pipeline `preview` POST (returns expanded
YAML, does not queue a run) which is gated behind --expand-pipelines. Nothing mutates state.

Seeded from the two expanded templates in tfd/. All targets/credentials are overridable via flags or
env vars. Stdlib only — no pip installs needed on a locked-down box.

Auth (set what you have; probes needing a missing credential are skipped, not failed):
  ADO_PAT                Azure DevOps PAT (basic auth, empty username). Also reads AZURE_DEVOPS_EXT_PAT.
  ARTIFACTORY_TOKEN      JFrog identity/access token (Bearer). OR ARTIFACTORY_USER + ARTIFACTORY_PASS.
  SONAR_TOKEN            SonarQube token (basic auth, token as username).
  DOCKER_USER/DOCKER_PASS  Artifactory-backed docker registry basic creds (usually same as Artifactory).
  BITBUCKET_TOKEN        Bitbucket Data Center HTTP access token (Bearer). OR BITBUCKET_USER + BITBUCKET_PASS.

Quick start (on the connected box):
  export ADO_PAT=xxxx ARTIFACTORY_TOKEN=yyyy
  python3 tfd_probe.py --collection <YOUR_COLLECTION> --insecure
  python3 tfd_probe.py --dry-run          # just print the plan
  python3 tfd_probe.py --download-templates --insecure   # pull the templates repo source offline
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------------------------------
# Knowledge base — everything mined from tfd/*_expanded_template.yaml. Doubles as documentation.
# --------------------------------------------------------------------------------------------------
KB = {
    # Confirmed product inventory (Jeremy, 2026-06):
    #   ADO Server 2022.2 (tfd) -> REST api-version 7.1 ; JFrog Enterprise+ 7.104.15 (rpo) ;
    #   SonarQube Enterprise 2026.1 (sonar) ; Atlassian Bitbucket Data Center 9.4.16 (git).
    "ado_hosts": {"prod": "https://tfd.pncint.net", "qa": "https://tfd-qa.pncint.net"},
    "automation_project": "PNC - ADO Enterprise Automation Pipeline",
    "templates_repo": "pnc-enterprise-templates",
    "templates_ref": "master",
    "deploy_repo_hint": "git.pncint.net/dse/dse-deploy.git",  # GitOps manifest repo (Bitbucket)
    "git_host": "https://git.pncint.net",
    "bitbucket_default_project": "dse",       # project key in git.pncint.net/<key>/<repo>.git
    "bitbucket_default_repo": "dse-deploy",
    "artifactory_base": "https://rpo.pncint.net/artifactory",
    "docker_registries": [
        "docker-stage.docker.pncint.net",
        "docker-release.docker.pncint.net",
        "docker-prestage.docker.pncint.net",
    ],
    # Service connections referenced by the templates (the serviceendpoint API reveals their URLs).
    "service_connections": [
        "enterprise_pnc_automation",            # git -> templates repo
        "enterprise_docker_stage_docker_pncint_net",
        "enterprise_sonar",
        "enterprise_pac_events_host",           # Policy-as-Code / PIMS
        "enterprise_rpo_telerik_nuget_repo",
        "enterprise_rpo_pncint_net",            # artifactory_service
    ],
    "variable_groups": ["TFD_DEVOPS", "NEXUS_IQ", "SYSDIG_SAAS"],
    # Custom in-house ADO task extensions to resolve via the distributedtask/tasks catalog.
    "tasks_of_interest": {
        "6d15af64-176c-496d-b583-fd2ae21d4df4": "custom checkout wrapper",
        "goldenImageTask": "golden image validation",
        "PimsTask": "PIMS / policy-as-code event emitter",
        "NexusTask": "Nexus IQ scan",
        "HelmTask": "Helm deploy",
        "15B84CA1-B62F-4A2A-A403-89B77A063157": "SonarQubePrepare (marketplace)",
        "6D01813A-9589-4B15-8491-8164AEB38055": "SonarQubeAnalyze (marketplace)",
        "291ed61f-1ee4-45d3-b1b0-bf822d9095ef": "SonarQubePublish (marketplace)",
    },
    # Artifactory paths worth listing (seen in the templates).
    "artifactory_probe_paths": [
        "generic-stage-local/pnc/tfd/tfd-build-preprocess",
        "generic-stage-local/pnc/dse",
        "generic-stage-local/pnc",
        "npm-stage-local/@pnc-dse",
        "maven-stage-local/pnc/dse",
    ],
}


# --------------------------------------------------------------------------------------------------
# HTTP plumbing
# --------------------------------------------------------------------------------------------------
@dataclass
class Http:
    insecure: bool = False
    cacert: str | None = None
    no_proxy: bool = False
    timeout: int = 30
    dry_run: bool = False
    plan: list[str] = field(default_factory=list)

    def _opener(self) -> urllib.request.OpenerDirector:
        ctx = ssl.create_default_context(cafile=self.cacert) if self.cacert else ssl.create_default_context()
        if self.insecure:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        handlers: list[urllib.request.BaseHandler] = [urllib.request.HTTPSHandler(context=ctx)]
        # Internal hosts almost always need to bypass the corp egress proxy.
        handlers.append(urllib.request.ProxyHandler({}) if self.no_proxy else urllib.request.ProxyHandler())
        return urllib.request.build_opener(*handlers)

    def request(self, method: str, url: str, headers: dict | None = None, body: bytes | None = None) -> dict:
        headers = headers or {}
        line = f"{method} {url}"
        if self.dry_run:
            self.plan.append(line)
            return {"ok": None, "status": "DRY_RUN", "url": url, "method": method}
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        started = time.time()
        try:
            with self._opener().open(req, timeout=self.timeout) as resp:
                raw = resp.read()
                return self._wrap(url, method, resp.status, dict(resp.headers), raw, started)
        except urllib.error.HTTPError as e:
            raw = e.read()
            return self._wrap(url, method, e.code, dict(e.headers or {}), raw, started, err=True)
        except Exception as e:  # noqa: BLE001 - probe must survive any single-target failure
            return {"ok": False, "url": url, "method": method, "status": "ERROR",
                    "error": f"{type(e).__name__}: {e}", "elapsed_ms": int((time.time() - started) * 1000)}

    @staticmethod
    def _wrap(url, method, status, headers, raw, started, err=False) -> dict:
        out = {"ok": (200 <= status < 300), "url": url, "method": method, "status": status,
               "elapsed_ms": int((time.time() - started) * 1000), "content_type": headers.get("Content-Type", "")}
        ctype = out["content_type"]
        if raw and ("json" in ctype or raw[:1] in (b"{", b"[")):
            try:
                out["json"] = json.loads(raw)
            except Exception:  # noqa: BLE001
                out["text"] = raw[:20000].decode("utf-8", "replace")
        elif raw:
            out["text"] = raw[:20000].decode("utf-8", "replace")
        if err:
            out["error"] = f"HTTP {status}"
        return out

    def get(self, url, headers=None):
        return self.request("GET", url, headers)

    def post_json(self, url, payload, headers=None):
        headers = {**(headers or {}), "Content-Type": "application/json"}
        return self.request("POST", url, headers, json.dumps(payload).encode())


def ado_headers(pat: str | None) -> dict:
    if not pat:
        return {}
    token = base64.b64encode(f":{pat}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Accept": "application/json"}


def sonar_headers(token: str | None) -> dict:
    if not token:
        return {}
    return {"Authorization": "Basic " + base64.b64encode(f"{token}:".encode()).decode()}


def artifactory_headers(token: str | None, user: str | None, pw: str | None) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    if user and pw:
        return {"Authorization": "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()}
    return {}


def basic_headers(user: str | None, pw: str | None) -> dict:
    if user and pw:
        return {"Authorization": "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()}
    return {}


# --------------------------------------------------------------------------------------------------
# Probe orchestration
# --------------------------------------------------------------------------------------------------
@dataclass
class Cfg:
    ado_host: str
    collection: str
    project: str
    templates_repo: str
    api: str
    artifactory: str
    sonar_host: str | None
    git_host: str
    bb_project: str
    bb_repo: str
    download_templates: bool
    expand_pipelines: bool
    all_projects: bool


class Probe:
    def __init__(self, http: Http, cfg: Cfg, out: Path, creds: dict):
        self.h = http
        self.c = cfg
        self.out = out
        self.creds = creds
        self.results: list[dict] = []

    def _collection_base(self) -> str:
        base = self.c.ado_host.rstrip("/")
        return f"{base}/{self.c.collection.strip('/')}" if self.c.collection else base

    def _proj(self) -> str:
        return urllib.parse.quote(self.c.project)

    def record(self, name: str, res: dict, note: str = "") -> dict:
        res = {"probe": name, "note": note, **res}
        self.results.append(res)
        status = res.get("status")
        flag = "ok " if res.get("ok") else ("·· " if status == "DRY_RUN" else "ERR")
        n = ""
        if isinstance(res.get("json"), dict):
            n = f"  keys={list(res['json'].keys())[:6]}"
            if "count" in res["json"]:
                n = f"  count={res['json']['count']}"
        elif isinstance(res.get("json"), list):
            n = f"  items={len(res['json'])}"
        print(f"  [{flag}] {name:<34} {status}{n}")
        # Persist raw payload for offline analysis.
        (self.out / f"{name}.json").write_text(json.dumps(res, indent=2))
        return res

    # ---- ADO -------------------------------------------------------------------------------------
    def ado(self):
        H = ado_headers(self.creds.get("ado_pat"))
        cb = self._collection_base()
        proj = self._proj()
        av = f"api-version={self.c.api}"

        print("\n[ azure devops ]")
        self.record("ado_connection_data", self.h.get(f"{cb}/_apis/connectionData?{av}", H))
        self.record("ado_projects", self.h.get(f"{cb}/_apis/projects?$top=1000&{av}", H))
        # Collection-level task catalog: resolves every custom GUID (goldenImageTask, PimsTask, ...).
        tasks = self.record("ado_task_definitions", self.h.get(f"{cb}/_apis/distributedtask/tasks?{av}", H))
        self._resolve_tasks(tasks)
        self.record("ado_agent_pools", self.h.get(f"{cb}/_apis/distributedtask/pools?{av}", H))
        self.record("ado_installed_extensions",
                    self.h.get(f"{cb}/_apis/extensionmanagement/installedextensions?{av}", H),
                    note="org-scoped; may 404 on ADO Server")

        print("\n[ azure devops :: project '%s' ]" % self.c.project)
        self.record("proj_repos", self.h.get(f"{cb}/{proj}/_apis/git/repositories?{av}", H))
        self.record("proj_build_definitions", self.h.get(f"{cb}/{proj}/_apis/build/definitions?{av}", H))
        self.record("proj_pipelines", self.h.get(f"{cb}/{proj}/_apis/pipelines?{av}", H))
        self.record("proj_variable_groups",
                    self.h.get(f"{cb}/{proj}/_apis/distributedtask/variablegroups?{av}", H))
        self.record("proj_service_endpoints",
                    self.h.get(f"{cb}/{proj}/_apis/serviceendpoint/endpoints?api-version=6.0-preview.4", H),
                    note="reveals underlying URLs of enterprise_* connections")

        # Templates repo: full recursive tree, then optionally download every text file.
        repo = urllib.parse.quote(self.c.templates_repo)
        tree = self.record("templates_tree", self.h.get(
            f"{cb}/{proj}/_apis/git/repositories/{repo}/items"
            f"?recursionLevel=Full&versionDescriptor.version={KB['templates_ref']}"
            f"&versionDescriptor.versionType=branch&{av}", H))
        if self.c.download_templates:
            self._download_templates(cb, proj, repo, tree, H, av)

        if self.c.all_projects:
            self._all_projects_repos(cb, H, av)

        if self.c.expand_pipelines:
            self._expand_pipelines(cb, proj, H)

    def _resolve_tasks(self, tasks_res: dict):
        data = tasks_res.get("json")
        items = data.get("value") if isinstance(data, dict) else (data if isinstance(data, list) else None)
        if not items:
            return
        index = {}
        for t in items:
            index[str(t.get("id", "")).lower()] = t
            index[str(t.get("name", "")).lower()] = t
        resolved = []
        for key, desc in KB["tasks_of_interest"].items():
            t = index.get(key.lower())
            if t:
                resolved.append({"query": key, "guess": desc, "name": t.get("name"),
                                 "id": t.get("id"), "version": t.get("version"),
                                 "contributionId": t.get("contributionIdentifier"),
                                 "inputs": [i.get("name") for i in t.get("inputs", [])]})
            else:
                resolved.append({"query": key, "guess": desc, "name": None, "note": "not found in catalog"})
        (self.out / "resolved_tasks.json").write_text(json.dumps(resolved, indent=2))
        print("    -> resolved_tasks.json (GUID/name -> task definition + inputs)")

    def _download_templates(self, cb, proj, repo, tree, H, av):
        data = tree.get("json")
        if not isinstance(data, dict):
            print("    !! templates tree unavailable; skipping download")
            return
        dest = self.out / "templates_repo"
        n = 0
        text_ext = (".yml", ".yaml", ".sh", ".ps1", ".json", ".md", ".txt", ".cs", ".py", ".tmpl", ".bicep")
        for item in data.get("value", []):
            if item.get("isFolder") or item.get("gitObjectType") == "tree":
                continue
            path = item.get("path", "")
            if not path.lower().endswith(text_ext):
                continue
            url = (f"{cb}/{proj}/_apis/git/repositories/{repo}/items"
                   f"?path={urllib.parse.quote(path)}&versionDescriptor.version={KB['templates_ref']}"
                   f"&versionDescriptor.versionType=branch&includeContent=true&$format=text&{av}")
            res = self.h.get(url, H)
            content = res.get("text") or (json.dumps(res.get("json")) if res.get("json") else None)
            if content:
                fp = dest / path.lstrip("/")
                fp.parent.mkdir(parents=True, exist_ok=True)
                fp.write_text(content)
                n += 1
        print(f"    -> downloaded {n} template files into {dest}")

    def _all_projects_repos(self, cb, H, av):
        projs = next((r for r in self.results if r["probe"] == "ado_projects"), {}).get("json", {})
        names = [p.get("name") for p in (projs.get("value", []) if isinstance(projs, dict) else [])]
        catalog = {}
        for name in names:
            r = self.h.get(f"{cb}/{urllib.parse.quote(name)}/_apis/git/repositories?{av}", H)
            repos = [x.get("name") for x in (r.get("json", {}).get("value", []) if isinstance(r.get("json"), dict) else [])]
            catalog[name] = repos
        (self.out / "all_projects_repos.json").write_text(json.dumps(catalog, indent=2))
        print(f"    -> all_projects_repos.json ({len(names)} projects mapped)")

    def _expand_pipelines(self, cb, proj, H):
        pls = next((r for r in self.results if r["probe"] == "proj_pipelines"), {}).get("json", {})
        items = pls.get("value", []) if isinstance(pls, dict) else []
        print(f"\n[ expand pipelines :: {len(items)} found (POST preview, no run queued) ]")
        for pl in items:
            pid = pl.get("id")
            if pid is None:
                continue
            res = self.h.post_json(
                f"{cb}/{proj}/_apis/pipelines/{pid}/preview?api-version=7.1-preview.1",
                {"previewRun": True}, H)
            final = res.get("json", {}).get("finalYaml") if isinstance(res.get("json"), dict) else None
            if final:
                fp = self.out / "expanded" / f"pipeline_{pid}_{(pl.get('name') or 'x').replace('/', '_')}.yaml"
                fp.parent.mkdir(parents=True, exist_ok=True)
                fp.write_text(final)
            self.record(f"expand_pipeline_{pid}", res, note=pl.get("name", ""))

    # ---- Artifactory -----------------------------------------------------------------------------
    def artifactory(self):
        H = artifactory_headers(self.creds.get("art_token"), self.creds.get("art_user"), self.creds.get("art_pass"))
        base = self.c.artifactory.rstrip("/")
        print("\n[ artifactory ]")
        self.record("art_ping", self.h.get(f"{base}/api/system/ping", H))
        self.record("art_version", self.h.get(f"{base}/api/system/version", H))
        self.record("art_repositories", self.h.get(f"{base}/api/repositories", H),
                    note="full repo list — the map of every stage/release/local repo")
        for p in KB["artifactory_probe_paths"]:
            safe = p.replace("/", "_").replace("@", "")
            self.record(f"art_storage_{safe}", self.h.get(f"{base}/api/storage/{p}?list&deep=1&listFolders=1", H))
        # AQL: powerful cross-repo search (needs perms). Find anything under pnc/tfd and pnc/dse.
        aql = 'items.find({"path":{"$match":"pnc/tfd*"}}).include("repo","path","name","created").limit(500)'
        self.record("art_aql_pnc_tfd",
                    self.h.request("POST", f"{base}/api/search/aql",
                                   {**H, "Content-Type": "text/plain"}, aql.encode()),
                    note="JFrog AQL; may require elevated perms")

    # ---- SonarQube -------------------------------------------------------------------------------
    def sonar(self):
        if not self.c.sonar_host:
            print("\n[ sonarqube ] skipped (set --sonar-host once you discover the enterprise URL,\n"
                  "              e.g. from proj_service_endpoints -> enterprise_sonar)")
            return
        H = sonar_headers(self.creds.get("sonar_token"))
        base = self.c.sonar_host.rstrip("/")
        print("\n[ sonarqube ]")
        self.record("sonar_status", self.h.get(f"{base}/api/system/status", H))
        self.record("sonar_version", self.h.get(f"{base}/api/server/version", H))
        self.record("sonar_projects", self.h.get(f"{base}/api/projects/search?ps=500", H))
        self.record("sonar_quality_gates", self.h.get(f"{base}/api/qualitygates/list", H))
        self.record("sonar_quality_profiles", self.h.get(f"{base}/api/qualityprofiles/search", H))

    # ---- Docker registries (Artifactory-backed, registry v2 API) ---------------------------------
    def docker(self):
        H = basic_headers(self.creds.get("docker_user"), self.creds.get("docker_pass")) \
            or artifactory_headers(self.creds.get("art_token"), self.creds.get("art_user"), self.creds.get("art_pass"))
        print("\n[ docker registries (v2) ]")
        for reg in KB["docker_registries"]:
            safe = reg.split(".")[0]
            self.record(f"docker_{safe}_v2", self.h.get(f"https://{reg}/v2/", H))
            self.record(f"docker_{safe}_catalog", self.h.get(f"https://{reg}/v2/_catalog?n=2000", H),
                        note="repository catalog (may be restricted)")

    # ---- git.pncint.net (Atlassian Bitbucket Data Center 9.x) -------------------------------------
    def bitbucket(self):
        # Bitbucket DC: Bearer HTTP access token, or basic user:app-password.
        if self.creds.get("bb_token"):
            H = {"Authorization": f"Bearer {self.creds['bb_token']}", "Accept": "application/json"}
        else:
            H = {**basic_headers(self.creds.get("bb_user"), self.creds.get("bb_pass")),
                 "Accept": "application/json"}
        base = self.c.git_host.rstrip("/")
        api = f"{base}/rest/api/1.0"
        bp, br = self.c.bb_project, self.c.bb_repo
        print("\n[ git.pncint.net (Bitbucket Data Center) ]")
        self.record("bb_application_properties", self.h.get(f"{api}/application-properties", H),
                    note="version/build of the Bitbucket instance")
        self.record("bb_projects", self.h.get(f"{api}/projects?limit=1000", H),
                    note="all visible projects (project keys)")
        self.record("bb_repos_in_project", self.h.get(f"{api}/projects/{bp}/repos?limit=1000", H),
                    note=f"repos under project '{bp}'")
        # Browse the GitOps manifest repo root + list all its files (reveals Helm/manifest layout).
        self.record("bb_deploy_browse_root",
                    self.h.get(f"{api}/projects/{bp}/repos/{br}/browse?at=refs/heads/master&limit=200", H),
                    note=f"{bp}/{br} root listing")
        self.record("bb_deploy_files",
                    self.h.get(f"{api}/projects/{bp}/repos/{br}/files?at=refs/heads/master&limit=2000", H),
                    note=f"recursive file paths in {bp}/{br}")


# --------------------------------------------------------------------------------------------------
def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Read-only recon probe for the PNC ADO/Artifactory ecosystem.")
    ap.add_argument("--ado-host", default=os.environ.get("ADO_HOST", KB["ado_hosts"]["prod"]),
                    help=f"default prod={KB['ado_hosts']['prod']} ; QA={KB['ado_hosts']['qa']}")
    ap.add_argument("--collection", default=os.environ.get("ADO_COLLECTION", ""),
                    help="ADO Server collection segment in the URL path (get it from the web UI URL "
                         "or by echoing $(System.CollectionUri) in any pipeline run).")
    ap.add_argument("--project", default=os.environ.get("ADO_PROJECT", KB["automation_project"]))
    ap.add_argument("--templates-repo", default=KB["templates_repo"])
    ap.add_argument("--api-version", default=os.environ.get("ADO_API_VERSION", "7.1-preview.1"),
                    help="ADO Server 2022.2 = 7.1-preview.1 (default); use 6.0 for 2020.")
    ap.add_argument("--artifactory", default=os.environ.get("ARTIFACTORY_BASE", KB["artifactory_base"]))
    ap.add_argument("--sonar-host", default=os.environ.get("SONAR_HOST"))
    ap.add_argument("--git-host", default=os.environ.get("GIT_HOST", KB["git_host"]))
    ap.add_argument("--bb-project", default=os.environ.get("BITBUCKET_PROJECT", KB["bitbucket_default_project"]),
                    help="Bitbucket project key to enumerate.")
    ap.add_argument("--bb-repo", default=os.environ.get("BITBUCKET_REPO", KB["bitbucket_default_repo"]),
                    help="Bitbucket repo slug to browse (the GitOps manifest repo).")
    ap.add_argument("--targets", default="ado,artifactory,sonar,docker,git",
                    help="comma list of probe groups to run.")
    ap.add_argument("--download-templates", action="store_true", help="pull templates repo source locally.")
    ap.add_argument("--expand-pipelines", action="store_true",
                    help="POST preview to expand every pipeline's finalYaml (no run is queued).")
    ap.add_argument("--all-projects", action="store_true", help="enumerate repos across every project.")
    ap.add_argument("--insecure", action="store_true", help="skip TLS verification (internal CA).")
    ap.add_argument("--cacert", default=os.environ.get("SSL_CERT_FILE"), help="path to internal CA bundle.")
    ap.add_argument("--no-proxy", action="store_true", help="ignore HTTP(S)_PROXY env (direct to internal hosts).")
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument("--out", default=None, help="output dir (default: ./tfd-probe-<epoch>).")
    ap.add_argument("--dry-run", action="store_true", help="print the request plan; make no calls.")
    args = ap.parse_args(argv)

    out = Path(args.out or f"tfd-probe-{int(time.time())}")
    out.mkdir(parents=True, exist_ok=True)

    http = Http(insecure=args.insecure, cacert=args.cacert, no_proxy=args.no_proxy,
                timeout=args.timeout, dry_run=args.dry_run)
    cfg = Cfg(ado_host=args.ado_host, collection=args.collection, project=args.project,
              templates_repo=args.templates_repo, api=args.api_version, artifactory=args.artifactory,
              sonar_host=args.sonar_host, git_host=args.git_host,
              bb_project=args.bb_project, bb_repo=args.bb_repo,
              download_templates=args.download_templates, expand_pipelines=args.expand_pipelines,
              all_projects=args.all_projects)
    creds = {
        "ado_pat": os.environ.get("ADO_PAT") or os.environ.get("AZURE_DEVOPS_EXT_PAT"),
        "art_token": os.environ.get("ARTIFACTORY_TOKEN"),
        "art_user": os.environ.get("ARTIFACTORY_USER"),
        "art_pass": os.environ.get("ARTIFACTORY_PASS"),
        "sonar_token": os.environ.get("SONAR_TOKEN"),
        "docker_user": os.environ.get("DOCKER_USER"),
        "docker_pass": os.environ.get("DOCKER_PASS"),
        "bb_token": os.environ.get("BITBUCKET_TOKEN"),
        "bb_user": os.environ.get("BITBUCKET_USER"),
        "bb_pass": os.environ.get("BITBUCKET_PASS"),
    }

    print(f"== TFD recon probe ==  out={out}  dry_run={args.dry_run}  insecure={args.insecure}")
    print(f"   ado={cfg.ado_host} collection={cfg.collection or '(none set!)'} project='{cfg.project}'")
    if not creds["ado_pat"] and not args.dry_run:
        print("   !! ADO_PAT not set — ADO probes will likely 203/401. Export it for real results.")

    probe = Probe(http, cfg, out, creds)
    targets = {t.strip() for t in args.targets.split(",") if t.strip()}
    dispatch = {"ado": probe.ado, "artifactory": probe.artifactory, "sonar": probe.sonar,
                "docker": probe.docker, "git": probe.bitbucket}
    for t in ("ado", "artifactory", "sonar", "docker", "git"):
        if t in targets:
            try:
                dispatch[t]()
            except Exception as e:  # noqa: BLE001
                print(f"  [ERR] probe group '{t}' crashed: {type(e).__name__}: {e}")

    if args.dry_run:
        (out / "plan.txt").write_text("\n".join(http.plan))
        print(f"\nDry run: {len(http.plan)} requests planned -> {out/'plan.txt'}")
    else:
        summary = [{k: r.get(k) for k in ("probe", "status", "ok", "note")} for r in probe.results]
        (out / "_summary.json").write_text(json.dumps(summary, indent=2))
        ok = sum(1 for r in probe.results if r.get("ok"))
        print(f"\nDone: {ok}/{len(probe.results)} probes ok -> {out}/  (raw JSON per probe + _summary.json)")
        print("NOTE: output may contain internal hostnames/IDs — do NOT commit it.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
