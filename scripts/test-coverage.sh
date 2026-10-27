#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p coverage

exec node \
  --test \
  --experimental-test-coverage \
  --test-coverage-include='src/graph/*.js' \
  --test-coverage-include='src/numericErrors.js' \
  --test-coverage-include='src/diagnostics.js' \
  --test-reporter=spec \
  --test-reporter-destination=stdout \
  --test-reporter=lcov \
  --test-reporter-destination=coverage/lcov.info \
  'test/*.test.js'
