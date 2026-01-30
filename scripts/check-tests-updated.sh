#!/bin/bash

set -e

BASE_BRANCH=origin/main

echo "Checking changed files..."

changed_files=$(git diff --name-only $BASE_BRANCH...HEAD)

echo "$changed_files"

src_changed=$(echo "$changed_files" | grep -E '^src/.*\.(js|ts)$' || true)
test_changed=$(echo "$changed_files" | grep -E '(\.test\.|__tests__)' || true)

if [[ -n "$src_changed" && -z "$test_changed" ]]; then
  echo "❌ Source files changed but no test files were updated."
  echo "Please add or update unit tests."
  exit 1
fi

echo "✅ Test update check passed."
