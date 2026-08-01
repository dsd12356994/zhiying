import { useState } from "react";
import { X, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import {
  EXPORT_PRESETS,
  useSettingsStore,
  type AiProviderKey,
  VISION_PROVIDERS,
} from "../../stores/settings-store";
import { resetOnboardingDone } from "../onboarding/OnboardingTour";

interface Props {
  open: boolean;
  onClose: () => void;
}

const shortcutLabels: Record<string, string> = {
  playPause: "播放 / 暂停",
  split: "分割片段",
  undo: "撤销",
  redo: "重做",
  marker: "添加标记",
  removeMarker: "删除最近标记",
};

type DialogTab = "general" | "ai" | "shortcuts";

// ─── AI Provider config row ──────────────────────────────────────

function ApiKeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-bg px-2 py-1.5 pr-8 text-xs text-fg outline-none focus:border-accent"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 text-fg-muted hover:text-fg"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
    </div>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────

export function SettingsDialog({ open, onClose }: Props) {
  const {
    theme, setTheme,
    language, setLanguage,
    exportPreset, setExportPreset,
    shortcuts, setShortcut,
    aiConfig, setAiConfig, setAiProviderConfig,
  } = useSettingsStore();

  const isEn = language === "en";
  const [activeTab, setActiveTab] = useState<DialogTab>("general");
  const [saved, setSaved] = useState(false);

  const t = isEn
    ? {
        title: "Preferences",
        tabGeneral: "General",
        tabAi: "AI Config",
        tabShortcuts: "Shortcuts",
        lang: "Language",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        exportPreset: "Export Preset",
        exportHint:
          "Current export pipeline applies fps first; resolution/bitrate are saved and will be wired into exporter next.",
        shortcuts: "Shortcuts",
        resetTour: "Reset Tour / 重置新手引导",
        aiProvider: "Default provider",
        aiProviderDesc: "Select the LLM that powers the chat agent (text tool-calling).",
        visionProvider: "Vision provider",
        visionProviderDesc: "Select the LLM for frame analysis (classifyFrames). Separate from text agent — use a cheap model for chat and a vision-capable model for scene understanding.",
        visionAuto: "Auto (same as text provider, if supported)",
        apiKey: "API Key",
        model: "Model",
        customUrl: "Custom endpoint (optional)",
        customUrlHint: "Leave blank to use the default endpoint.",
        saveAi: "Save AI settings",
        savedMsg: "Saved",
        heygenLabel: "HeyGen API Key",
        heygenDesc: "For AI digital human avatar generation. Get it at app.heygen.com",
        heygenPlaceholder: "Paste your HeyGen API key...",
        providerNames: {
          mock: "Mock (offline)",
          openai: "OpenAI",
          deepseek: "DeepSeek",
          claude: "Claude (Anthropic)",
          zhipu: "ZhiPu (GLM)",
        },
        providerHints: {
          mock: "No API key required. Uses built-in pattern matching — good for demos.",
          openai: "Requires an OpenAI API key. Default model: gpt-4.1-mini.",
          deepseek: "Requires a DeepSeek API key. Affordable and capable.",
          claude: "Requires an Anthropic API key. Default model: claude-sonnet-4-6.",
          zhipu: "Requires a ZhiPu API key. Supports vision (GLM-4V) and text (GLM-4-Flash).",
        },
      }
    : {
        title: "偏好设置",
        tabGeneral: "通用",
        tabAi: "AI 配置",
        tabShortcuts: "快捷键",
        lang: "语言 / Language",
        theme: "主题",
        light: "浅色",
        dark: "深色",
        exportPreset: "导出预设",
        exportHint: "当前导出链路优先应用帧率；分辨率与码率已保存为项目偏好，后续将接入导出器。",
        shortcuts: "快捷键",
        resetTour: "重置新手引导 / Reset Tour",
        aiProvider: "默认模型提供方（文本）",
        aiProviderDesc: "选择驱动 AI 助手对话和工具调用的语言模型。",
        visionProvider: "视觉识别模型",
        visionProviderDesc: "选择帧分析（classifyFrames）使用的视觉模型。可与文本模型分开选择——文本用便宜的 DeepSeek，视觉用智谱 GLM-4V。",
        visionAuto: "自动（优先跟随文本模型，若不支持视觉则自动选可用模型）",
        apiKey: "API Key",
        model: "模型名称",
        customUrl: "自定义 API 地址（可选）",
        customUrlHint: "留空则使用默认官方地址。",
        saveAi: "保存 AI 配置",
        savedMsg: "已保存",
        heygenLabel: "HeyGen API Key（数字人）",
        heygenDesc: "用于 AI 数字人生成。前往 app.heygen.com 注册获取。",
        heygenPlaceholder: "粘贴 HeyGen API Key...",
        providerNames: {
          mock: "Mock（离线）",
          openai: "OpenAI",
          deepseek: "DeepSeek",
          claude: "Claude（Anthropic）",
          zhipu: "智谱（GLM）",
        },
        providerHints: {
          mock: "无需 API Key，使用内置规则匹配，适合演示。",
          openai: "需要 OpenAI API Key，默认模型 gpt-4.1-mini。",
          deepseek: "需要 DeepSeek API Key，价格实惠、能力强。",
          claude: "需要 Anthropic API Key，默认模型 claude-sonnet-4-6。",
          zhipu: "需要智谱 API Key。支持视觉（GLM-4V）和文本（GLM-4-Flash），中文理解出色。",
        },
      };

  const PROVIDER_KEYS: AiProviderKey[] = ["mock", "openai", "deepseek", "claude", "zhipu"];

  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTestVideoApi() {
    setTesting(true);
    setTestResult(null);
    const { videoGenProvider, videoGenRegion, runwayApiKey, falApiKey, dashscopeApiKey, replicateApiKey } = aiConfig;
    try {
      let res: Response;
      let body: string;
      if (videoGenProvider === "fal") {
        if (!falApiKey.trim()) { setTestResult({ ok: false, msg: "未填写 fal.ai API Key" }); setTesting(false); return; }
        res = await fetch("/proxy/fal-queue/fal-ai/wan-t2v", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Key ${falApiKey.trim()}` },
          body: JSON.stringify({ prompt: "test connection", num_seconds: 1, resolution: "480p" }),
        });
        body = await res.text();
        const j = JSON.parse(body) as Record<string, unknown>;
        if (j.request_id) setTestResult({ ok: true, msg: `Key 有效 ✅ 视频生成已提交，request_id: ${j.request_id}` });
        else if (body.includes("Authentication")) setTestResult({ ok: false, msg: "Key 无效：Authentication required（Key 格式错误或已过期）" });
        else setTestResult({ ok: false, msg: `fal.ai 返回：${body.slice(0, 200)}` });
      } else if (videoGenProvider === "tongyi") {
        if (!dashscopeApiKey.trim()) { setTestResult({ ok: false, msg: "未填写 DashScope API Key" }); setTesting(false); return; }
        const base = videoGenRegion === "singapore" ? "/proxy/dashscope-intl" : "/proxy/dashscope";
        res = await fetch(`${base}/api/v1/services/aigc/video-generation/video-synthesis`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${dashscopeApiKey.trim()}`, "X-DashScope-Async": "enable" },
          body: JSON.stringify({ model: "wan2.7-t2v", input: { prompt: "test" }, parameters: { resolution: "720P", aspect_ratio: "9:16", duration: 5 } }),
        });
        body = await res.text();
        const j = JSON.parse(body) as Record<string, unknown>;
        const out = j.output as Record<string, unknown> | undefined;
        if (out?.task_id) setTestResult({ ok: true, msg: `Key 有效 ✅ task_id: ${out.task_id}` });
        else if (body.includes("InvalidApiKey")) setTestResult({ ok: false, msg: "Key 无效：InvalidApiKey（Key 格式错误或已过期）" });
        else setTestResult({ ok: false, msg: `DashScope 返回：${body.slice(0, 300)}` });
      } else if (videoGenProvider === "cogvideo") {
        if (!replicateApiKey.trim()) { setTestResult({ ok: false, msg: "未填写 Replicate API Key" }); setTesting(false); return; }
        res = await fetch("/proxy/replicate/v1/account", { headers: { Authorization: `Token ${replicateApiKey.trim()}` } });
        body = await res.text();
        if (res.ok) setTestResult({ ok: true, msg: `Key 有效 ✅ Replicate 账户：${body.slice(0, 100)}` });
        else setTestResult({ ok: false, msg: `Replicate 返回 ${res.status}：${body.slice(0, 200)}` });
      } else if (videoGenProvider === "runway") {
        if (!runwayApiKey.trim()) { setTestResult({ ok: false, msg: "未填写 Runway API Key" }); setTesting(false); return; }
        res = await fetch("/proxy/runway/v1/organization", { headers: { Authorization: `Bearer ${runwayApiKey.trim()}`, "X-Runway-Version": "2024-11-06" } });
        body = await res.text();
        if (res.ok) setTestResult({ ok: true, msg: `Key 有效 ✅ Runway 账户：${body.slice(0, 100)}` });
        else setTestResult({ ok: false, msg: `Runway 返回 ${res.status}：${body.slice(0, 200)}` });
      } else {
        setTestResult({ ok: false, msg: "请先选择一个视频提供商" });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: `网络错误：${e instanceof Error ? e.message : String(e)}` });
    }
    setTesting(false);
  }

  function handleSaveAi() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!open) return null;

  const tabs: { id: DialogTab; label: string }[] = [
    { id: "general", label: t.tabGeneral },
    { id: "ai", label: t.tabAi },
    { id: "shortcuts", label: t.tabShortcuts },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="flex w-[520px] flex-col rounded-xl border border-border bg-bg-elev shadow-2xl animate-modal-pop"
        style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex flex-none items-center justify-between px-5 pt-5 pb-3">
          <div className="text-sm font-semibold text-fg">{t.title}</div>
          <button type="button" onClick={onClose} className="text-fg-muted hover:text-fg">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-none border-b border-border px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative mr-1 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent)" : "transparent"}`,
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── General tab ── */}
          {activeTab === "general" && (
            <>
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-2 text-xs font-medium text-fg">{t.lang}</div>
                <div className="flex items-center gap-2">
                  {(["zh", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`rounded-md px-3 py-1 text-xs ${
                        language === lang ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
                      }`}
                    >
                      {lang === "zh" ? "中文" : "English"}
                    </button>
                  ))}
                </div>

                <div className="mb-2 mt-3 text-xs font-medium text-fg">{t.theme}</div>
                <div className="flex items-center gap-2">
                  {(["light", "dark"] as const).map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setTheme(th)}
                      className={`rounded-md px-3 py-1 text-xs ${
                        theme === th ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
                      }`}
                    >
                      {th === "light" ? t.light : t.dark}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-2 text-xs font-medium text-fg">{t.exportPreset}</div>
                <select
                  value={exportPreset}
                  onChange={(e) => setExportPreset(e.target.value as typeof exportPreset)}
                  className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none"
                >
                  {EXPORT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} · {preset.width}x{preset.height} · {preset.bitrateMbps}Mbps
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-fg-muted">{t.exportHint}</div>
              </section>
            </>
          )}

          {/* ── AI Config tab ── */}
          {activeTab === "ai" && (
            <>
              {/* Provider selector */}
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-1 text-xs font-medium text-fg">{t.aiProvider}</div>
                <div className="mb-2 text-[11px] text-fg-muted">{t.aiProviderDesc}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PROVIDER_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAiConfig({ provider: key })}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                      style={{
                        borderColor: aiConfig.provider === key ? "var(--accent)" : "var(--border)",
                        backgroundColor: aiConfig.provider === key
                          ? "color-mix(in srgb, var(--accent) 10%, var(--bg-2))"
                          : "var(--bg-3)",
                        color: aiConfig.provider === key ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                        style={{
                          borderColor: aiConfig.provider === key ? "var(--accent)" : "var(--border)",
                          backgroundColor: aiConfig.provider === key ? "var(--accent)" : "transparent",
                        }}
                      >
                        {aiConfig.provider === key && <Check size={9} color="#fff" />}
                      </span>
                      {t.providerNames[key]}
                    </button>
                  ))}
                </div>
                {aiConfig.provider !== "mock" && (
                  <div className="mt-2 rounded-md px-2 py-1.5 text-[11px] text-fg-muted"
                    style={{ backgroundColor: "var(--bg-3)" }}>
                    {t.providerHints[aiConfig.provider]}
                  </div>
                )}
                {aiConfig.provider === "mock" && (
                  <div className="mt-2 rounded-md px-2 py-1.5 text-[11px] text-fg-muted"
                    style={{ backgroundColor: "var(--bg-3)" }}>
                    {t.providerHints.mock}
                  </div>
                )}
              </section>

              {/* Vision provider selector */}
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-1 text-xs font-medium text-fg">{t.visionProvider}</div>
                <div className="mb-2 text-[11px] text-fg-muted">{t.visionProviderDesc}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    key="auto"
                    type="button"
                    onClick={() => setAiConfig({ visionProvider: "" })}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                    style={{
                      borderColor: !aiConfig.visionProvider ? "var(--accent)" : "var(--border)",
                      backgroundColor: !aiConfig.visionProvider
                        ? "color-mix(in srgb, var(--accent) 10%, var(--bg-2))"
                        : "var(--bg-3)",
                      color: !aiConfig.visionProvider ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: !aiConfig.visionProvider ? "var(--accent)" : "var(--border)",
                        backgroundColor: !aiConfig.visionProvider ? "var(--accent)" : "transparent",
                      }}
                    >
                      {!aiConfig.visionProvider && <Check size={9} color="#fff" />}
                    </span>
                    {t.visionAuto}
                  </button>
                  {VISION_PROVIDERS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAiConfig({ visionProvider: key })}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                      style={{
                        borderColor: aiConfig.visionProvider === key ? "var(--accent)" : "var(--border)",
                        backgroundColor: aiConfig.visionProvider === key
                          ? "color-mix(in srgb, var(--accent) 10%, var(--bg-2))"
                          : "var(--bg-3)",
                        color: aiConfig.visionProvider === key ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                        style={{
                          borderColor: aiConfig.visionProvider === key ? "var(--accent)" : "var(--border)",
                          backgroundColor: aiConfig.visionProvider === key ? "var(--accent)" : "transparent",
                        }}
                      >
                        {aiConfig.visionProvider === key && <Check size={9} color="#fff" />}
                      </span>
                      {t.providerNames[key]}
                    </button>
                  ))}
                </div>
              </section>

              {/* Per-provider config */}
              {(["openai", "deepseek", "claude", "zhipu"] as const).map((provider) => (
                <section
                  key={provider}
                  className="rounded-lg border border-border bg-bg-2 p-3"
                  style={{
                    opacity: aiConfig.provider === provider || aiConfig.provider === "mock" ? 1 : 0.5,
                  }}
                >
                  <div className="mb-2 text-xs font-medium text-fg">
                    {t.providerNames[provider]}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 text-[11px] text-fg-muted">{t.apiKey}</div>
                      <ApiKeyInput
                        value={aiConfig[provider].apiKey}
                        onChange={(v) => setAiProviderConfig(provider, { apiKey: v })}
                        placeholder={`${t.providerNames[provider]} API Key`}
                      />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] text-fg-muted">{t.model}</div>
                      <input
                        value={aiConfig[provider].model}
                        onChange={(e) => setAiProviderConfig(provider, { model: e.target.value })}
                        className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
                        spellCheck={false}
                      />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] text-fg-muted">{t.customUrl}</div>
                      <input
                        value={aiConfig[provider].apiUrl}
                        onChange={(e) => setAiProviderConfig(provider, { apiUrl: e.target.value })}
                        placeholder={
                          provider === "openai"
                            ? "https://api.openai.com/v1/chat/completions"
                            : provider === "deepseek"
                            ? "https://api.deepseek.com/v1/chat/completions"
                            : provider === "zhipu"
                            ? "https://open.bigmodel.cn/api/paas/v4/chat/completions"
                            : "https://api.anthropic.com/v1/messages"
                        }
                        className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
                        spellCheck={false}
                      />
                      <div className="mt-0.5 text-[10px] text-fg-muted">{t.customUrlHint}</div>
                    </div>
                  </div>
                </section>
              ))}

              {/* HeyGen API Key */}
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-2 text-xs font-medium text-fg">{t.heygenLabel}</div>
                <div className="mb-2 text-[11px] text-fg-muted">{t.heygenDesc}</div>
                <ApiKeyInput
                  value={aiConfig.heygenApiKey}
                  onChange={(v) => setAiConfig({ heygenApiKey: v })}
                  placeholder={t.heygenPlaceholder}
                />
              </section>

              {/* Video Generation API Keys */}
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="mb-2 text-xs font-medium text-fg">视频生成 API（文生视频）</div>

                {/* Provider selector */}
                <select
                  value={aiConfig.videoGenProvider}
                  onChange={(e) => { setAiConfig({ videoGenProvider: e.target.value as "tongyi" }); setTestResult(null); }}
                  className="mb-2 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none"
                >
                  <option value="fal">fal.ai — Wan 2.1 T2V（推荐，境外可用）</option>
                  <option value="tongyi">通义万相 — DashScope（阿里云）</option>
                  <option value="cogvideo">CogVideoX — Replicate（开源）</option>
                  <option value="runway">Runway Gen-4（最贵但最稳）</option>
                </select>

                {/* Per-provider hint + key field */}
                {aiConfig.videoGenProvider === "fal" && (
                  <>
                    <div className="mb-2 rounded p-2 text-[10px]" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>
                      注册 fal.ai → Dashboard → API Keys → 创建 Key（fal-... 开头）→ 粘贴到下面。
                      首次注册赠送 $1 免费额度，Wan 2.1 约 $0.005/秒。
                    </div>
                    <ApiKeyInput value={aiConfig.falApiKey} onChange={(v) => { setAiConfig({ falApiKey: v }); setTestResult(null); }} placeholder="fal-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </>
                )}
                {aiConfig.videoGenProvider === "tongyi" && (
                  <>
                    <div className="mb-2 rounded p-2 text-[10px]" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>
                      阿里云百炼 → API-KEY → 创建（sk-... 开头）→ 粘贴到下面。
                      wan2.7-t2v 模型，有免费额度。
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] text-fg-muted">节点：</span>
                      {(["beijing", "singapore"] as const).map((r) => (
                        <button key={r} type="button"
                          onClick={() => setAiConfig({ videoGenRegion: r })}
                          className={`rounded px-2 py-1 text-[10px] ${aiConfig.videoGenRegion === r ? "bg-accent text-accent-fg" : "border border-border text-fg-muted"}`}
                        >{r === "beijing" ? "北京" : "新加坡"}</button>
                      ))}
                    </div>
                    <ApiKeyInput value={aiConfig.dashscopeApiKey} onChange={(v) => { setAiConfig({ dashscopeApiKey: v }); setTestResult(null); }} placeholder="sk-xxxxxxxxxxxx" />
                  </>
                )}
                {aiConfig.videoGenProvider === "cogvideo" && (
                  <>
                    <div className="mb-2 rounded p-2 text-[10px]" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>
                      注册 replicate.com → 头像 → API tokens → 创建（r8_... 开头）→ 粘贴到下面。
                      开源模型，按用量计费。
                    </div>
                    <ApiKeyInput value={aiConfig.replicateApiKey} onChange={(v) => { setAiConfig({ replicateApiKey: v }); setTestResult(null); }} placeholder="r8_xxxxxxxxxxxx" />
                  </>
                )}
                {aiConfig.videoGenProvider === "runway" && (
                  <>
                    <div className="mb-2 rounded p-2 text-[10px]" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>
                      注册 runwayml.com → Settings → API Keys → 创建（key_... 开头）→ 粘贴到下面。
                      需要订阅 Standard 以上套餐（$35/月），每秒约 $0.05。
                    </div>
                    <ApiKeyInput value={aiConfig.runwayApiKey} onChange={(v) => { setAiConfig({ runwayApiKey: v }); setTestResult(null); }} placeholder="key_xxxxxxxxxxxx" />
                  </>
                )}

                {/* Test button + result */}
                <button
                  type="button"
                  onClick={() => { void handleTestVideoApi(); }}
                  disabled={testing}
                  className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : null}
                  {testing ? "测试中…" : "测试 API 连接"}
                </button>
                {testResult && (
                  <div className={`mt-2 rounded p-2 text-[11px] ${testResult.ok ? "text-green-600" : "text-red-500"}`}
                    style={{ backgroundColor: testResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
                    {testResult.msg}
                  </div>
                )}
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAi}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  {saved ? (
                    <>
                      <Check size={13} />
                      {t.savedMsg}
                    </>
                  ) : (
                    t.saveAi
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Shortcuts tab ── */}
          {activeTab === "shortcuts" && (
            <>
              <section className="rounded-lg border border-border bg-bg-2 p-3">
                <div className="space-y-2">
                  {Object.entries(shortcuts).map(([action, binding]) => (
                    <div key={action} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-fg-2">{shortcutLabels[action] ?? action}</span>
                      <input
                        value={binding}
                        onChange={(e) => setShortcut(action, e.target.value)}
                        className="w-36 rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg outline-none"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetOnboardingDone();
                    onClose();
                    window.location.reload();
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
                >
                  {t.resetTour}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
