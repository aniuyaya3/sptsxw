// 分类体系：功能 / 强项 / 形态；关键词命中即打标签，新作品自动归类
export const DIMS = [
  { id: 'func', label: '按功能', tags: [
    { id: 'gen', label: '生成模型', kw: ['video generation', 'video-generation', 'text-to-video', 'image-to-video', 't2v', 'i2v', 'diffusion', 'dit', '生成模型', '模型', '权重', 'checkpoint', 'wan', 'hunyuan', 'cogvideo', 'ltx', 'sana', 'mochi', '生成视频'] },
    { id: 'avatar', label: '数字人 / 口播', kw: ['avatar', 'digital human', 'talking', 'lip', '数字人', '口播', '说话视频', 'wav2lip', '口型'] },
    { id: 'edit', label: '剪辑 / 后期', kw: ['edit', 'editing', 'moviepy', '字幕', '配音', 'dub', '后期', '剪辑', 'transcri'] },
    { id: 'pipeline', label: '创作流水线', kw: ['workflow', 'pipeline', 'storyboard', '分镜', '剧本', '短剧', 'drama', 'studio', '一站式', '全流程', '工作台', '平台'] },
    { id: 'tool', label: '本地工具 / 客户端', kw: ['comfyui', 'desktop', 'client', '插件', '本地', 'offline', '一键'] },
    { id: 'accel', label: '加速 / 推理', kw: ['fast', 'inference', '推理', '加速', '蒸馏', 'real-time', 'realtime', 'speed', '量化'] },
  ]},
  { id: 'strength', label: '按强项', tags: [
    { id: 'speed', label: '速度快', kw: ['fast', 'real-time', 'realtime', 'speed', '加速', 'ltx', '蒸馏', '实时'] },
    { id: 'quality', label: '画质优先', kw: ['quality', 'high-resolution', '1080', '720p', 'hd', '4k', '画质', '高清', '电影级', '高保真'] },
    { id: 'local', label: '本地 / 低显存', kw: ['local', '8gb', 'vram', 'consumer', 'comfyui', 'offline', '本地', '显存', '消费级'] },
    { id: 'zh', label: '中文友好', kw: ['中文', 'chinese', '剪映', '国产', '万相', '混元', '智谱'] },
    { id: 'prod', label: '生产可用', kw: ['production', 'industrial', 'enterprise', 'commercial', '商用', '团队', '工业级'] },
  ]},
  { id: 'form', label: '按形态', tags: [
    { id: 'app', label: '桌面 / 本地应用', kw: ['desktop', 'app', 'comfyui', 'client', '客户端'] },
    { id: 'cli', label: '命令行 / 库', kw: ['cli', 'library', 'sdk', 'pip install', 'python package', '库'] },
    { id: 'web', label: 'Web 工作台', kw: ['web', 'studio', 'platform', 'dashboard', '界面', '工作台', '平台'] },
    { id: 'skill', label: 'Agent 技能', kw: ['skill', 'mcp', 'claude', 'agent', '智能体'] },
  ]},
];

const INDEX = {};
DIMS.forEach(d => d.tags.forEach(t => { INDEX[t.id] = { ...t, dim: d.label }; }));

export function tagMeta(id) { return INDEX[id] || { id, label: id, dim: '' }; }

export function classify(it) {
  const hay = [it.repo, it.summary, it.highlight, it.fit, (it.tags || []).join(' '), it.language || '']
    .join(' ').toLowerCase();
  const out = [];
  for (const dim of DIMS) {
    for (const t of dim.tags) {
      if (t.kw.some(k => hay.includes(k))) out.push(t.id);
    }
  }
  if (!DIMS[0].tags.some(t => out.includes(t.id))) out.push('gen');
  return out;
}

export function itemsByTag(days, tagId) {
  const seen = new Set();
  const out = [];
  for (const d of days) {
    for (const it of d.items || []) {
      if (seen.has(it.repo.toLowerCase())) continue;
      if (!classify(it).includes(tagId)) continue;
      seen.add(it.repo.toLowerCase());
      out.push({ ...it, date: d.date });
    }
  }
  return out;
}
