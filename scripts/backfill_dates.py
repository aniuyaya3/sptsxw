#!/usr/bin/env python3
"""补齐指定日期区间的 picks 条目（复用 fetch_daily.py 的过滤/分类逻辑）。"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKS = os.path.join(ROOT, "public", "data", "picks.json")
API = "https://api.github.com"
UA = "videogen-daily-bot"

QUERIES = [
    "topic:video-generation", "topic:text-to-video", "topic:image-to-video",
    "topic:video-editing", "topic:digital-human",
    "video generation in:name,description", "text to video in:name,description",
    "video ai in:name,description", "video generation python",
]
DENY = {
    "huggingface/diffusers", "comfyanonymous/comfyui", "huggingface/transformers",
    "automatic1111/stable-diffusion-webui", "langchain-ai/langchain",
    "openai/openai-python", "comfy-org/comfyui", "modelscope/modelscope",
}
JUNK = ("download", "scraper", "crawl", "tiktok", "douyin", "watermark",
        "ascii", "imagen-pytorch", "stable-diffusion-webui")
RELEVANT = [
    "video", "t2v", "i2v", "text-to-video", "image-to-video", "avatar", "talking",
    "lip-sync", "lipsync", "storyboard", "short-drama", "drama", "vace", "wan",
    "hunyuan", "cogvideo", "mochi", "ltx", "animate", "motion", "storyboard",
]
CATEGORIES = [
    ("推理加速", ["inference", "acceleration", "fast", "distill", "quantiz", "lightx", "speed"],
     "把主流开源视频模型的推理成本压下来", "自己部署出片、要把显存和时延压住的团队"),
    ("本地部署", ["local", "comfyui", "consumer", "8gb", "vram", "offline"],
     "消费级显卡就能跑起来，不依赖云端 API", "想完全本地化、不想按次付费的创作者"),
    ("视频编辑", ["edit", "editing", "post-production", "cut", "timeline", "dubbing"],
     "把剪辑、配音、字幕这些后期环节自动化", "做批量内容生产、需要统一风格的团队"),
    ("数字人", ["avatar", "digital human", "talking", "lip", "portrait"],
     "从一张图或一段音频驱动出人物视频", "做口播、虚拟主播、课程视频的创作者"),
    ("创作平台", ["workflow", "agent", "studio", "platform", "storyboard", "short-drama", "drama"],
     "把剧本、分镜、素材、成片串成一条可复用的流水线", "做短剧、漫剧、系列化内容的中文团队"),
    ("生成模型", ["diffusion", "dit", "transformer", "wan", "hunyuan", "cogvideo", "model"],
     "开源视频生成相关项目，可自行编译与二次开发", "想动手跑通链路的开发者"),
]
CN_LANG = {"python": "Python", "typescript": "TypeScript", "javascript": "JavaScript",
           "go": "Go", "rust": "Rust", "c++": "C++", "jupyter notebook": "Jupyter"}


def gh(url):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": UA,
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def collect():
    found = {}
    for q in QUERIES:
        url = (f"{API}/search/repositories?q={urllib.parse.quote(q)}"
               "&sort=stars&order=desc&per_page=20")
        try:
            data = gh(url)
        except Exception as e:
            print(f"  ! {q}: {e}", file=sys.stderr)
            continue
        for it in data.get("items", []):
            key = it["full_name"].lower()
            if key not in found or it["stargazers_count"] > found[key]["stargazers_count"]:
                found[key] = it
    return list(found.values())


def relevant(repo):
    hay = " ".join([
        repo.get("description") or "", repo.get("name") or "",
    ]).lower()
    if any(k in hay for k in JUNK):
        return False
    return any(k in hay for k in RELEVANT)


def categorize(repo):
    hay = " ".join([
        repo.get("description") or "", repo.get("name") or "",
    ]).lower()
    for tag, keys, highlight, fit in CATEGORIES:
        if any(k in hay for k in keys):
            return tag, highlight, fit
    return "生成模型", "开源视频生成相关项目，可自行编译与二次开发", "想动手跑通链路的开发者"


def template_item(repo):
    tag, highlight, fit = categorize(repo)
    desc = (repo.get("description") or "").strip().rstrip(".")
    if not desc:
        desc = f"{repo['full_name']}，{repo.get('language') or '开源'} 实现的视频生成项目"
    elif len(desc) > 110:
        desc = desc[:107].rstrip() + "…"
    return {
        "repo": repo["full_name"],
        "url": repo["html_url"],
        "stars": repo["stargazers_count"],
        "stars_today": 0,
        "language": CN_LANG.get((repo.get("language") or "").lower(), repo.get("language") or ""),
        "summary": desc,
        "highlight": highlight,
        "fit": fit,
        "tags": [tag],
    }


def main():
    if len(sys.argv) < 3:
        sys.exit("用法: python3 scripts/backfill_dates.py <开始日期> <结束日期>")
    start = date.fromisoformat(sys.argv[1])
    end = date.fromisoformat(sys.argv[2])

    with open(PICKS, encoding="utf-8") as f:
        data = json.load(f)
    existing = {d["date"] for d in data.get("days", [])}
    already = {i["repo"].lower() for d in data.get("days", []) for i in d.get("items", [])}

    print("检索候选仓库 …")
    repos = collect()
    print(f"去重后 {len(repos)} 个仓库")

    fresh = [r for r in repos
             if r["full_name"].lower() not in already
             and r["full_name"].lower() not in DENY
             and relevant(r)]
    fresh.sort(key=lambda r: r["stargazers_count"], reverse=True)

    dates = []
    d = start
    while d <= end:
        if d.isoformat() not in existing:
            dates.append(d.isoformat())
        d += timedelta(days=1)

    need = len(dates) * 3
    if len(fresh) < need:
        sys.exit(f"候选仓库不足：需要 {need} 个，只有 {len(fresh)} 个")

    picked = fresh[:need]
    days = data.get("days", [])
    idx = 0
    for ds in dates:
        items = []
        for _ in range(3):
            r = picked[idx]
            idx += 1
            items.append(template_item(r))
        days = [x for x in days if x["date"] != ds]
        days.append({"date": ds, "items": items})
        print(f"  {ds}: " + ", ".join(it["repo"] for it in items))

    days.sort(key=lambda d: d["date"], reverse=True)
    days = days[:60]

    from datetime import datetime
    out = {"updated": datetime.now().astimezone().isoformat(timespec="seconds"),
           "days": days}
    with open(PICKS, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"✅ 已写入 {PICKS}，共 {len(days)} 期")


if __name__ == "__main__":
    main()
