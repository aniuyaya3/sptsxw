#!/bin/sh
# 每天 12:00 由 cron 调用：写入当天数据并推送到 GitHub（触发 Cloudflare Pages 重建）
set -e
cd "$(dirname "$0")/.."

KEY="${DEPLOY_KEY:-$HOME/.ssh/videogen_deploy}"
[ -f "$KEY" ] || { echo "缺少部署密钥: $KEY" >&2; exit 1; }

git add -A
if git diff --cached --quiet; then
  echo "无变更，跳过推送"
  exit 0
fi
git -c user.name="videogen-bot" -c user.email="bot@localhost" \
    commit -m "data: $(date +%F) 视频生成热榜"
GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    git push origin HEAD:main
echo "✅ 已推送，等待 Cloudflare Pages 构建"
