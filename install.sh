#!/bin/bash
# Wavemetric Claude Code 설치 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/Wavemetric/claude-code-template/main/install.sh | bash

set -e

BASE_URL="https://raw.githubusercontent.com/Wavemetric/claude-code-template/main/global"
TARGET="$HOME/.claude"

echo "Wavemetric Claude Code 원칙 설치 중..."

# 디렉토리 생성
mkdir -p "$TARGET/rules"

# 파일 다운로드
curl -fsSL "$BASE_URL/CLAUDE.md"              -o "$TARGET/CLAUDE.md"
curl -fsSL "$BASE_URL/rules/01-stack.md"      -o "$TARGET/rules/01-stack.md"
curl -fsSL "$BASE_URL/rules/02-security.md"   -o "$TARGET/rules/02-security.md"
curl -fsSL "$BASE_URL/rules/03-workflow.md"   -o "$TARGET/rules/03-workflow.md"

echo ""
echo "설치 완료. 이제 모든 프로젝트에서 팀 원칙이 적용됩니다."
echo "설치 위치: $TARGET"
