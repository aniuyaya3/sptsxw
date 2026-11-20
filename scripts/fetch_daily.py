#!/usr/bin/env python3
"""每日抓取 3 个「视频生成」方向的高热度 GitHub 仓库。

在 GitHub Actions 里跑，纯标准库，无第三方依赖。

可选：设置环境变量 LLM_API_KEY（OpenAI 兼容接口）+ LLM_BASE_URL + LLM_MODEL，
会用模型生成中文简介；没有则用模板生成。
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKS = os.path.join(ROOT, "public", "data", "picks.json")
API = "https://api.github.com"
UA = "videogen-daily-bot"
DEDUPE_DAYS = 90
WANT = 3

QUERIES = [
    "topic:video-generation",
    "topic:text-to-video",
    "topic:image-to-video",
    "topic:video-editing",
    "topic:digital-human",
    "video generation in:name,description",
    "text to video in:name,description",
]

DENY = {
    "huggingface/diffusers", "comfyanonymous/comfyui", "huggingface/transformers",
    "automatic1111/stable-diffusion-webui", "langchain-ai/langchain",
    "openai/openai-python", "comfy-org/comfyui", "modelscope/modelscope",
}

# 相关性关键词：命中任意一个才算"视频生成"方向
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
     "开源视频生成模型本体，可直接微调或二次开发", "要自研、微调或做垂直场景的研究与工程团队"),
]

CN_LANG = {"python": "Python", "typescript": "TypeScript", "javascript": "JavaScript",
           "go": "Go", "rust": "Rust", "c++": "C++", "jupyter notebook": "Jupyter"}


def gh(url):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": UA,
        "X-GitHub-Api-Version": "2022-11-28",
    })
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def load_seen():
    if not os.path.exists(PICKS):
        return set()
    try:
        data = json.load(open(PICKS, encoding="utf-8"))
    except Exception:
        return set()
    cutoff = (date.today() - timedelta(days=DEDUPE_DAYS)).isoformat()
    return {i["repo"].lower()
            for d in data.get("days", []) if d["date"] >= cutoff
            for i in d.get("items", []) if i.get("repo")}


def collect(since):
    found = {}
    for q in QUERIES:
        url = (f"{API}/search/repositories?q={urllib.parse.quote(q + f' pushed:>{since}')}"
               "&sort=stars&order=desc&per_page=12")
        try:
            data = gh(url)
        except Exception as e:
            print(f"  ! {q}: {e}", file=sys.stderr)
            continue
        for it in data.get("items", []):
            key = it["full_name"].lower()
            if key not in found or it["stargazers_count"] > found[key]["stargazers_count"]:
                found[key] = it
        print(f"  {q}: {len(data.get('items', []))} 条")
    return list(found.values())


JUNK = ("download", "scraper", "crawl", "tiktok", "douyin", "watermark",
        "ascii", "imagen-pytorch", "stable-diffusion-webui")


def relevant(repo):
    hay = " ".join([
        repo.get("description") or "", " ".join(repo.get("topics") or []),
        repo.get("name") or "",
    ]).lower()
    if any(k in hay for k in JUNK):
        return False
    return any(k in hay for k in RELEVANT)


def categorize(repo):
    hay = " ".join([
        repo.get("description") or "", " ".join(repo.get("topics") or []),
        repo.get("name") or "",
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
    topics = [t for t in (repo.get("topics") or []) if len(t) <= 18][:2]
    return {
        "repo": repo["full_name"],
        "url": repo["html_url"],
        "stars": repo["stargazers_count"],
        "language": CN_LANG.get((repo.get("language") or "").lower(), repo.get("language") or ""),
        "summary": desc,
        "highlight": highlight,
        "fit": fit,
        "tags": [tag] + topics,
    }


def llm_enrich(items):
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return items
    base_url = (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL") or "gpt-4o-mini"
    payload = {
        "model": model,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": "你是技术编辑。用中文为 GitHub 仓库写简介，"
             "summary 不超过 60 字，highlight 不超过 40 字，fit 不超过 30 字。"
             "只输出 JSON 数组，字段：repo, summary, highlight, fit, tags(字符串数组，2-3 个中文标签)。"},
            {"role": "user", "content": json.dumps([
                {"repo": i["repo"], "description": i["summary"], "language": i["language"],
                 "stars": i["stars"]} for i in items], ensure_ascii=False)},
        ],
    }
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = json.load(r)["choices"][0]["message"]["content"]
        text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
        enriched = {e["repo"]: e for e in json.loads(text)}
    except Exception as e:
        print(f"  ! LLM 调用失败，回退模板: {e}", file=sys.stderr)
        return items
    for it in items:
        e = enriched.get(it["repo"])
        if not e:
            continue
        for k in ("summary", "highlight", "fit"):
            if e.get(k):
                it[k] = str(e[k])[:160]
        if isinstance(e.get("tags"), list) and e["tags"]:
            it["tags"] = [str(t)[:12] for t in e["tags"]][:3]
    return items


def main():
    since = (date.today() - timedelta(days=30)).isoformat()
    print(f"检索 pushed>{since} …")
    repos = collect(since)
    print(f"去重后 {len(repos)} 个仓库")

    seen = load_seen()
    fresh = [r for r in repos
             if r["full_name"].lower() not in seen
             and r["full_name"].lower() not in DENY
             and relevant(r)]
    fresh.sort(key=lambda r: (r["stargazers_count"], r["pushed_at"]), reverse=True)

    picked = fresh[:WANT]
    if len(picked) < WANT:
        print(f"  新面孔不足（{len(picked)}/{WANT}），放宽到未收录过的仓库", file=sys.stderr)
        extra = [r for r in repos if r not in picked]
        picked += extra[:WANT - len(picked)]

    if not picked:
        sys.exit("没有可推送的仓库")

    items = [template_item(r) for r in picked]
    items = llm_enrich(items)

    out = "/tmp/items.json"
    json.dump(items, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"已写入 {out}")
    for i in items:
        print(f"  - {i['repo']} ★{i['stars']}")


if __name__ == "__main__":
    main()
