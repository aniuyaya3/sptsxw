#!/bin/sh
# 每日 12:00 全流程：写入数据 → 提交 → 推送 → 触发 Cloudflare Pages 部署
# 用法: sh scripts/daily.sh /tmp/items.json [YYYY-MM-DD]
set -e
cd "$(dirname "$0")/.."
ITEMS="${1:?需要传入 items.json 路径}"
DATE="${2:-$(date +%F)}"
python3 scripts/update_picks.py --date "$DATE" --file "$ITEMS"
sh scripts/publish.sh
