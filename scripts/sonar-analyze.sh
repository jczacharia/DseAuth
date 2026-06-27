#!/usr/bin/env bash
# Local SonarQube analysis of the main branch against a developer instance.
#
# Runs against a fresh clone of the committed HEAD in a throwaway .sonar-tmp/ dir, mirroring
# CI's `checkout: self` so the analyzed file set matches the pipeline (no local node_modules,
# bin/obj, or coverage cruft). Uncommitted working-tree changes are intentionally NOT analyzed.
# The clone dir is wiped before every run (deterministic) and removed afterward.
#
# Requires: dotnet-sonarscanner (global tool), Java 21+, and an analysis token in
# SONARQUBE_TOKEN_GLOBAL_ANALYSIS. Override SONAR_HOST_URL to target a different server.
# Set SONAR_KEEP_CLONE=1 to keep .sonar-tmp/ after the run for debugging.
set -euo pipefail

: "${SONARQUBE_TOKEN_GLOBAL_ANALYSIS:?Set SONARQUBE_TOKEN_GLOBAL_ANALYSIS to a SonarQube analysis token}"

SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
PROJECT_KEY="${SONAR_PROJECT_KEY:-dse}"
VERSION="${SONAR_PROJECT_VERSION:-2.2.2}"
# Release matches CI and is required for Dse.Api's BuildSpa target (Release-only) to provision
# the SPA in the fresh clone, without which the Vitest half of `dotnet test` has no node_modules.
CONFIG="${SONAR_BUILD_CONFIG:-Release}"

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
CLONE_DIR="$REPO_ROOT/.sonar-tmp"
COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"

cleanup() { [[ -n "${SONAR_KEEP_CLONE:-}" ]] || rm -rf "$CLONE_DIR"; }
rm -rf "$CLONE_DIR"          # clear before starting -> deterministic
trap cleanup EXIT

# Fresh checkout of the committed tree, pinned to the current HEAD commit.
git clone --quiet "$REPO_ROOT" "$CLONE_DIR"
git -C "$CLONE_DIR" checkout --quiet "$COMMIT"
cd "$CLONE_DIR"

# node_modules/coverage are absent in the CI container but the build/test steps regenerate them
# inside this clone; exclude them so analysis matches CI instead of indexing generated files.
EXCLUSIONS='**/obj/**,**/bin/**,**/node_modules/**,**/coverage/**,**/*.bin,*Tests*.cs,*testresult*.xml,*opencover*.xml,**/Program.cs,*Dockerfile*,**/quality_engineering/**,**/Dse.UI/src/app/api/**,**/Dse.UI/src/app/ui/**'
TEST_EXCLUSIONS='*Tests*.cs,*testresult*.xml,*opencover*.xml'

dotnet sonarscanner begin \
  /k:"$PROJECT_KEY" \
  /n:"$PROJECT_KEY" \
  /v:"$VERSION" \
  /d:sonar.host.url="$SONAR_HOST_URL" \
  /d:sonar.token="$SONARQUBE_TOKEN_GLOBAL_ANALYSIS" \
  /d:sonar.scanner.skipJreProvisioning=true \
  /d:sonar.scm.disabled=true \
  /d:sonar.exclusions="$EXCLUSIONS" \
  /d:sonar.coverage.exclusions="$TEST_EXCLUSIONS" \
  /d:sonar.test.exclusions="$TEST_EXCLUSIONS" \
  /d:sonar.cs.opencover.reportsPaths="**/coverage.opencover.xml" \
  /d:sonar.cs.vstest.reportsPaths="**/*.trx"

dotnet build Dse.slnx -c "$CONFIG"

dotnet test Dse.slnx -c "$CONFIG" --no-build \
  --logger "trx" \
  /p:CollectCoverage=true /p:CoverletOutputFormat=opencover

dotnet sonarscanner end /d:sonar.token="$SONARQUBE_TOKEN_GLOBAL_ANALYSIS"

echo "Analysis submitted: ${SONAR_HOST_URL}/dashboard?id=${PROJECT_KEY}"
