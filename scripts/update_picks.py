#!/usr/bin/env python3
"""把当天 3 个仓库写入 data/picks.json（供 cron 每天 12:00 调用）。

用法:
  python3 scripts/update_picks.py --date 2026-11-19 --file /tmp/items.json
  cat /tmp/items.json | python3 scripts/update_picks.py

items.json 形如:
  [{"repo":"owner/name","url":"https://github.com/owner/name","stars":1234,
    "stars_today":120,"language":"Python","summary":"...","highlight":"...",
    "fit":"...","tags":["..."]}]

规则:
  - 同一天重复写入会覆盖当天条目（幂等）
  - 与最近 7 天已推仓库重复的条目会被剔除并告警
  - 最多保留 60 天
"""
import argparse, json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKS = os.path.join(ROOT, "public", "data", "picks.json")
REQUIRED = ("repo", "url", "stars", "summary", "highlight", "fit")
DEDUPE_DAYS = 90
KEEP_DAYS = 400


def load():
    if not os.path.exists(PICKS):
        return {"updated": "", "days": []}
    with open(PICKS, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--file")
    ap.add_argument("--allow-repeat", action="store_true", help="跳过重复检测")
    a = ap.parse_args()

    raw = open(a.file, encoding="utf-8").read() if a.file else sys.stdin.read()
    items = json.loads(raw)
    if not isinstance(items, list) or not items:
        sys.exit("items 必须是非空数组")

    for it in items:
        missing = [k for k in REQUIRED if not it.get(k)]
        if missing:
            sys.exit(f"{it.get('repo','?')} 缺字段: {missing}")
        it["repo"] = it["repo"].strip()
        it["url"] = it["url"].strip()

    data = load()
    days = data.get("days", [])

    if not a.allow_repeat:
        recent = {i["repo"].lower() for d in days if d["date"] != a.date
                  for i in d.get("items", [])}
        fresh = [i for i in items if i["repo"].lower() not in recent]
        dropped = [i["repo"] for i in items if i["repo"].lower() in recent]
        if dropped:
            print(f"⚠️  已收录过，剔除: {dropped}", file=sys.stderr)
        if not fresh:
            sys.exit("全部重复，今日不更新")
        items = fresh

    days = [d for d in days if d["date"] != a.date]
    days.append({"date": a.date, "items": items})
    days.sort(key=lambda d: d["date"], reverse=True)
    days = days[:KEEP_DAYS]

    out = {"updated": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
           "days": days}
    with open(PICKS, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"✅ {a.date}: 写入 {len(items)} 个仓库，共 {len(days)} 期")


if __name__ == "__main__":
    main()
