#!/bin/bash
# deploy.sh - test → commit → push 자동화 스크립트
# 사용법:
#   bash deploy.sh              # 기본 커밋 메시지
#   bash deploy.sh "커밋 메시지"  # 커밋 메시지 지정

MSG="${1:-Auto commit: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "=== Running tests ==="
pytest
if [ $? -ne 0 ]; then
    echo "Tests failed. Aborting."
    exit 1
fi

echo "=== Committing ==="
git add .
git commit -m "$MSG"

echo "=== Pushing ==="
git push

echo "Done!"
