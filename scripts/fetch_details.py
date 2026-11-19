#!/usr/bin/env python3
"""为 picks.json 里的每个仓库抓 README，抽成「怎么用」结构化数据。

输出：public/data/details/<owner>__<name>.json
  {repo, intro, requirements[], steps[{title, code}], docs[], fetched}

纯标准库。已存在的文件默认跳过（--force 覆盖）。
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKS = os.path.join(ROOT, "public", "data", "picks.json")
OUTDIR = os.path.join(ROOT, "public", "data", "details")
ZHP = os.path.join(ROOT, "scripts", "zh_content.json")
UA = "videogen-daily-bot"

REQ_RE = re.compile(r"(vram|显存|gb\s*(of\s*)?(vram|gpu|memory)|cuda|python\s*3\.\d|pytorch|torch\s*[>=]|node\.?js|nvidia)", re.I)
SHELL_LANGS = {"bash", "sh", "shell", "console", "zsh", "terminal", "cmd", "powershell", ""}
CMD_HINT = re.compile(r"^\s*(\$|#|pip|pip3|uv |conda|python|python3|git clone|docker|npm|pnpm|yarn|curl|wget|cd |make|npx|huggingface-cli|hf )", re.M)


def slug(full):
    return full.replace("/", "__")


def gh_raw(full):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{full}/readme",
        headers={"Accept": "application/vnd.github.raw", "User-Agent": UA},
    )
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if tok:
        req.add_header("Authorization", f"Bearer {tok}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def clean_inline(s):
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)          # 图片
    s = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", "", s)  # 徽章
    s = re.sub(r"<[^>]+>", "", s)                        # html
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)       # 链接留文字
    s = re.sub(r"[`*_>]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse(md):
    lines = md.splitlines()
    # 1) 简介：第一个正文段落（跳标题/徽章/目录）
    intro = ""
    buf = []
    for ln in lines[:500]:
        t = ln.strip()
        skip = (not t) or t.startswith("#") or t.startswith("<") or t.startswith("|") \
            or t.startswith("[![") or t.startswith("![") or t.startswith("[![")
        if skip:
            if buf:
                break
            continue
        if re.match(r"^(table of contents|contents|目录)$", t, re.I):
            break
        if re.match(r"^https?://\S+$", t) or t.startswith("user-attachments"):
            continue
        buf.append(t)
    if buf:
        intro = clean_inline(" ".join(buf))
    if len(intro) > 220:
        intro = intro[:217].rstrip() + "…"

    # 2) 环境要求
    reqs = []
    for ln in lines:
        t = clean_inline(ln.lstrip("-*0123456789. "))
        if re.match(r"^[$#>]|^(pip|uv |conda|git |docker|python|npm|pnpm|yarn|make|curl|wget|cd |npx|huggingface-cli|hf )", t, re.I):
            continue
        if 6 < len(t) < 140 and REQ_RE.search(t) and not t.startswith("http"):
            if t not in reqs:
                reqs.append(t)
        if len(reqs) >= 5:
            break

    # 3) 步骤：fenced code block + 最近的标题
    steps = []
    heading = ""
    i = 0
    while i < len(lines):
        ln = lines[i]
        if re.match(r"^#{2,4}\s+", ln):
            heading = clean_inline(re.sub(r"^#+\s*", "", ln))[:60]
        m = re.match(r"^\s*```(\w*)\s*$", ln)
        if m:
            lang = m.group(1).lower()
            body, i = [], i + 1
            while i < len(lines) and not re.match(r"^\s*```\s*$", lines[i]):
                body.append(lines[i]); i += 1
            code = "\n".join(body).strip()
            if (lang in SHELL_LANGS or CMD_HINT.search(code)) and code and len(code) <= 900:
                title = heading or "快速开始"
                if steps and steps[-1]["title"] == title:
                    steps[-1]["code"] += "\n\n" + code
                else:
                    steps.append({"title": title, "code": code})
        i += 1
        if len(steps) >= 5:
            break

    # 4) 文档入口
    docs = []
    for m in re.finditer(r"\[([^\]]{2,40})\]\((https?://[^)\s]+)\)", md):
        txt, url = clean_inline(m.group(1)), m.group(2)
        if any(k in url.lower() for k in ("docs", "documentation", "wiki", "arxiv")):
            if url not in [d["url"] for d in docs]:
                docs.append({"title": txt[:40], "url": url})
        if len(docs) >= 3:
            break

    return {"intro": intro, "requirements": reqs, "steps": steps, "docs": docs}


def llm_zh(full, parsed):
    """没有人工中文文案时，用模型生成（需要 LLM_API_KEY）。"""
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return None
    base_url = (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL") or "gpt-4o-mini"
    brief = {
        "repo": full,
        "readme_intro": parsed.get("intro", "")[:400],
        "steps": [{"i": i, "title": s["title"], "code": s["code"][:300]}
                  for i, s in enumerate(parsed.get("steps", []))],
    }
    payload = {
        "model": model,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": "你是中文技术编辑。根据仓库信息写中文说明，"
             "输出 JSON：{\"what\":\"这个项目做什么（60字内）\",\"note\":\"一句注意点或空字符串\","
             "\"steps\":[{\"i\":序号,\"title\":\"中文步骤名\",\"desc\":\"一句话怎么做（40字内）\"}]}。"
             "只输出 JSON，不要解释。"},
            {"role": "user", "content": json.dumps(brief, ensure_ascii=False)},
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
        data = json.loads(text)
    except Exception as e:
        print(f"    ! LLM 生成中文失败: {e}", file=sys.stderr)
        return None
    steps = []
    for st in data.get("steps", []):
        idx = st.get("i")
        if not isinstance(idx, int) or idx >= len(parsed.get("steps", [])):
            continue
        steps.append({"title": st.get("title", "步骤"), "desc": st.get("desc", ""),
                      "code": parsed["steps"][idx]["code"]})
    if not steps:
        return None
    return {"what": data.get("what", ""), "note": data.get("note", ""), "steps": steps}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="只处理某个 repo")
    a = ap.parse_args()

    data = json.load(open(PICKS, encoding="utf-8"))
    repos = []
    for d in data["days"]:
        for it in d["items"]:
            if it["repo"] not in repos:
                repos.append(it["repo"])
    if a.only:
        repos = [r for r in repos if r.lower() == a.only.lower()]

    os.makedirs(OUTDIR, exist_ok=True)
    ok = skip = fail = 0
    for full in repos:
        path = os.path.join(OUTDIR, slug(full) + ".json")
        if os.path.exists(path) and not a.force:
            skip += 1
            continue
        try:
            md = gh_raw(full)
            parsed = parse(md)
            try:
                zh = json.load(open(ZHP, encoding="utf-8")).get(full)
            except Exception:
                zh = None
            if not zh:
                zh = llm_zh(full, parsed)
            if zh:
                zh_steps = []
                for st in zh.get("steps", []):
                    code = st.get("code")
                    if code is None and "i" in st:
                        raw = parsed["steps"]
                        code = raw[st["i"]]["code"] if st["i"] < len(raw) else ""
                    if code:
                        zh_steps.append({"title": st.get("title", "步骤"),
                                         "desc": st.get("desc", ""), "code": code})
                parsed["zh"] = {"what": zh.get("what", ""), "note": zh.get("note", ""),
                                "steps": zh_steps}
            parsed.update({
                "repo": full,
                "url": f"https://github.com/{full}",
                "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })
            json.dump(parsed, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            ok += 1
            print(f"  ✓ {full}: steps={len(parsed['steps'])} reqs={len(parsed['requirements'])}")
        except Exception as e:
            fail += 1
            print(f"  ✗ {full}: {e}", file=sys.stderr)
    print(f"完成：新增 {ok}，跳过 {skip}，失败 {fail}")


if __name__ == "__main__":
    main()
