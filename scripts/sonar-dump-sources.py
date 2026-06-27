#!/usr/bin/env python3
"""Dump the source code SonarQube has stored for a project into a directory.

SonarQube has no bulk source export, so this reconstructs the project's file tree by
listing file components (api/components/tree) and fetching each file's stored source
(api/sources/raw), writing them under the output directory at their project paths.

Usage:  sonar-dump-sources.py <project-key> [output-dir]
        output-dir defaults to ./sonar-dump/<project-key> and is wiped before each run.

Env:
  SONARQUBE_URL         server base URL (default http://localhost:9000)
  SONARQUBE_TOKEN_USER  token with Browse permission on the project (required)
"""
import base64
import json
import os
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request

PAGE_SIZE = 500  # web API maximum


def fail(msg):
    sys.exit(f"error: {msg}")


def main():
    args = sys.argv[1:]
    if args and args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    if not args:
        sys.exit(__doc__)

    project_key = args[0]
    base_url = os.environ.get("SONARQUBE_URL", "http://localhost:9000").rstrip("/")
    token = os.environ.get("SONARQUBE_TOKEN_USER") or fail(
        "set SONARQUBE_TOKEN_USER to a token with Browse permission"
    )
    out_dir = os.path.abspath(args[1] if len(args) > 1 else os.path.join("sonar-dump", project_key))
    if out_dir in ("/", os.path.expanduser("~")):
        fail(f"refusing to use unsafe output dir: {out_dir}")

    headers = {"Authorization": "Basic " + base64.b64encode(f"{token}:".encode()).decode()}

    def api(path, **params):
        url = f"{base_url}{path}?{urllib.parse.urlencode(params)}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            fail(f"{path} -> HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")

    # Collect every file component, paging through the tree.
    files, page = [], 1
    while True:
        data = json.loads(api("/api/components/tree", component=project_key,
                              qualifiers="FIL", ps=PAGE_SIZE, p=page))
        comps = data.get("components", [])
        files.extend((c["key"], c["path"]) for c in comps)
        if not comps or page * PAGE_SIZE >= data["paging"]["total"]:
            break
        page += 1

    if not files:
        fail(f"no files found for project '{project_key}' (check key and permissions)")
    if len(files) >= 10000:
        print("warning: hit the 10000-result API cap; some files may be missing", file=sys.stderr)

    # Wipe before writing so repeated dumps are deterministic.
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    print(f"Dumping {len(files)} files from '{project_key}' -> {out_dir}")
    for i, (key, path) in enumerate(files, 1):
        dest = os.path.normpath(os.path.join(out_dir, path))
        if os.path.commonpath([out_dir, dest]) != out_dir:
            fail(f"component path escapes output dir: {path}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(api("/api/sources/raw", key=key))
        print(f"  [{i}/{len(files)}] {path}")

    print(f"Done. {len(files)} files written to {out_dir}")


if __name__ == "__main__":
    main()
