#!/usr/bin/env python3
"""把 scripts/zh_content.json 里的中文说明合并进 public/data/details/*.json。

zh_content.json 结构:
  {"owner/name": {"what": "...", "note": "...", "steps": [{"i": 0, "title": "...", "desc": "..."} | {"title": "...", "desc": "...", "code": "..."}]}}
其中 i 表示复用抓取到的第 i 个代码块。
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZHP = os.path.join(ROOT, "scripts", "zh_content.json")
DET = os.path.join(ROOT, "public", "data", "details")


def build(repo, detail, z):
    steps = []
    for s in z.get("steps", []):
        code = s.get("code")
        if code is None and "i" in s:
            idx = s["i"]
            raw = detail.get("steps", [])
            code = raw[idx]["code"] if idx < len(raw) else ""
        if not code:
            continue
        steps.append({"title": s.get("title", "步骤"), "desc": s.get("desc", ""), "code": code})
    return {"what": z.get("what", ""), "note": z.get("note", ""), "steps": steps}


def main():
    zh = json.load(open(ZHP, encoding="utf-8"))
    done = 0
    for f in sorted(glob.glob(os.path.join(DET, "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        z = zh.get(d["repo"])
        if not z:
            print(f"  - {d['repo']}: 无中文内容，跳过")
            continue
        d["zh"] = build(d["repo"], d, z)
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        done += 1
    print(f"合并完成：{done} 个")


if __name__ == "__main__":
    main()
