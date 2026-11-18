# VideoGen Daily

每天 12:00 自动更新：3 个「视频生成」方向的高热度 GitHub 仓库。

- 前端：纯静态（HTML + CSS + 原生 JS），无构建步骤
- 数据：`public/data/picks.json`
- 部署：GitHub Actions → Cloudflare Pages
- 每日写入：本机 cron 用 **deploy key** 推送到 `main`，触发 Actions 自动部署

## 目录

```
public/            # 部署产物（Pages 上传这个目录）
  index.html
  assets/style.css
  assets/app.js
  data/picks.json  # 每日数据
scripts/
  update_picks.py  # 写入当天 3 个仓库（幂等、去重）
  publish.sh       # 提交并推送，触发部署
.github/workflows/deploy.yml
```

```

私钥在本机 `~/.ssh/videogen_deploy`（600），`scripts/publish.sh` 用它推送。

### 2. 仓库变量 / Secrets

Settings → Secrets and variables → Actions：

| 名称 | 值 | 说明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API Token | 权限至少 `Cloudflare Pages: Edit` + `Account Settings: Read` |
| `CLOUDFLARE_ACCOUNT_ID` | CF 账户 ID | 控制台右侧栏可复制 |

Secrets 或 Variables 都行，workflow 写了 `secrets.X || vars.X`。

### 3. 首次推送

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

推送后 Actions 自动创建 Pages 项目 `videogen-daily` 并部署，
域名形如 `https://videogen-daily.pages.dev`。

## 每日更新

```bash
python3 scripts/update_picks.py --date 2026-11-19 --file /tmp/items.json
sh scripts/publish.sh
```

`items.json` 字段：`repo / url / stars / stars_today(可选) / language / summary / highlight / fit / tags`

## 本地预览

```bash
python3 -m http.server 8099 --directory public
```
