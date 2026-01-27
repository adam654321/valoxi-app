#!/bin/bash
# Playwright test runner for Replit environment

export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium

# Run tests based on arguments
if [ "$1" == "ui" ]; then
  npx playwright test --ui
elif [ "$1" == "auth" ]; then
  npx playwright test --project=chromium
elif [ "$1" == "sanity" ]; then
  npx playwright test sanity.spec.ts --project=chromium-no-auth
else
  npx playwright test --project=chromium-no-auth "$@"
fi
