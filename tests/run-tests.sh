#!/bin/bash
# Playwright test runner for Replit environment

export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium

# Run tests based on arguments
case "$1" in
  "all")
    npx playwright test
    ;;
  "auth")
    npx playwright test auth.spec.ts --project=chromium-no-auth
    ;;
  "sanity")
    npx playwright test sanity.spec.ts --project=chromium-no-auth
    ;;
  "companies")
    npx playwright test target-companies.spec.ts --project=chromium
    ;;
  "documents")
    npx playwright test documents.spec.ts --project=chromium
    ;;
  "analysis")
    npx playwright test detailed-analysis.spec.ts --project=chromium
    ;;
  "")
    npx playwright test
    ;;
  *)
    npx playwright test "$@"
    ;;
esac
