(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    try { root.__agPrismTelemetry?.destroy?.(); } catch {}
    if (typeof window !== 'undefined' && window !== root) {
      try { window.__agPrismTelemetry?.destroy?.(); } catch {}
    }
    const api = factory(root);
    root.__agPrismTelemetry = api;
    if (typeof window !== 'undefined') window.__agPrismTelemetry = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (globalRoot) {
  'use strict';

  const BAR_ID = 'ag-pulse-status-bar';
  const PRISM_BAR_ID = 'ag-prism-pulse-bar';
  const PRISM_BAR_ATTR = 'data-ag-prism-pulse-bar';
  const FALLBACK_ATTR = 'data-ag-prism-fallback';
  const HID_ATTR = 'data-ag-prism-hidden';
  const METRICS_BINDING = '__agPrismMetricsCall';
  const WAIT_MS = 1500;
  const GRACE_MS = 3500;
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const TIER_ATTR = 'data-t';
  const TIER_STYLE_ATTR = 'data-pt';
  const TIER_VALS = ['0', '1', '1 2', '1 2 3', '1 2 3 4', '1 2 3 4 5'];
  const expCss = (s) => {
    const t = ['var(--e)', ':host([data-t~="', '[data-card="', 'color-mix(in srgb,var(--c) ', 'overflow:hidden;white-space:nowrap;', 'transform:scale(.9) translateX(4px);pointer-events:none!important', 'border-radius:', 'background:'];
    for (let i = 0; i < t.length; i++) s = s.split('$' + i).join(t[i]);
    return s.replace(/!(?!important)/g, '!important');
  };
  const TIER_CSS = expCss('[hidden]{display:none!}:host{--e:cubic-bezier(.22,1,.36,1);--c:var(--pv-tint,var(--pulse-ring,#3186ff))}.bar{transition:gap .28s $0}.bar>:is(.chip,.dot){$4max-width:132px;opacity:1;transform-origin:right;transition:max-width .28s $0,opacity .17s ease-out,padding .28s $0,margin .28s $0,gap .28s $0,transform .28s $0,background .16s,border-color .22s,box-shadow .22s}.bar>[data-card="cache"]{max-width:240px}.bar>$2context"]{max-width:136px}.bar>$2quota"]{max-width:152px}.bar>.dot{max-width:16px}:where(.bar>.chip>*:not(.context-ring):not(svg)){$4max-width:108px;flex-shrink:0;opacity:1;transform-origin:right;transition:max-width .28s $0,opacity .17s ease-out,margin .28s $0,padding .28s $0,transform .28s $0}.bar>$2quota"]>.quota-txt{max-width:124px}.context-ring{will-change:transform;transition:transform .28s $0}:host([data-q-compact="1"]) :is(.q-sep,.q-5-txt),$12"]) :is(.cache-total,.sub-badge,.q-sep,.q-5-txt,$2cache"] .dim,.countdown),$14"]) $2context"] .context-label,$14"]) $2quota"] :is(.quota-bars,.q-w-lbl),$15"]) $2context"]>:not(.context-ring){max-width:0!important;flex-shrink:1!important;opacity:0!;margin:0!;padding:0!;$5}$13"]) .bar>:is($2cache"],$2week"]),$14"]) .bar>:is($2speed"],$2five"],.dot),$15"]) .bar>$2quota"]{max-width:0!;min-width:0!;flex-shrink:1!;opacity:0!;padding:0!;margin:0!;gap:0!;border:0!;$5}$14"]) .bar{gap:0}$15"]) $2context"]{width:26px!;min-width:26px!;height:26px!;padding:0!;gap:0!;$6999px!;justify-content:center!;$7$39%,transparent);border:1px solid $328%,rgba(148,163,184,.28))}$15"]) $2context"]:is(:hover,[aria-expanded="true"]){$7$317%,transparent);border-color:$348%,rgba(148,163,184,.4));box-shadow:0 0 10px -2px $345%,transparent)}$15"]) .context-ring{transform:scale(1.27)}:host([data-pv-motion="off"]) :is(.bar,.bar *),:host-context(html[data-ag-cs-resizing="1"]) :is(.bar,.bar *){transition:none!}@media (prefers-reduced-motion:reduce){:is(.bar,.bar *){transition:none!}}');

  const SHADOW_CSS = expCss(':host,*,::before,::after{box-sizing:border-box}:host,.bar,.chip{display:inline-flex;align-items:center}:host{--_dm:var(--muted-foreground,#94A3B8);--_fg:var(--foreground,#eef1f7);--_sb:#C4B5FD;--_rb:linear-gradient(90deg,#F472B6,#A855F7 38%,#38BDF8 72%,#34D399);--_rbt:linear-gradient(90deg,#F59E0B,#FB7185);--_rbl:linear-gradient(90deg,#F97316,#E11D48);--_ca-t:#FBBF24;--_lo-t:#FB7185;--_qtr:rgba(148,163,184,.24);--_pb:linear-gradient(135deg,rgba(244,114,182,.28),rgba(168,85,247,.3) 36%,rgba(56,189,248,.28) 70%,rgba(52,211,153,.24));--_cs:linear-gradient(160deg,rgba(19,23,36,.96),rgba(13,16,26,.95));--_qa:linear-gradient(135deg,rgba(35,24,44,.94),rgba(25,26,44,.94) 48%,rgba(19,33,44,.94));--_cm:rgba(255,255,255,.045);--_mp:rgba(255,255,255,.065);--_vw:rgba(255,255,255,.038);--_vws:inset 0 1px 0 rgba(255,255,255,.06);flex:0 0 auto;position:relative;font:11px/16px Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--_fg);user-select:none;z-index:20}:host-context(html[data-ag-cs-theme="light"]),:host-context(.light),:host([data-pv-light="1"]){--_dm:#475569;--_fg:#0f172a;--_sb:#6D28D9;--_rb:linear-gradient(90deg,#EC4899,#8B5CF6 38%,#0EA5E9 72%,#10B981);--_ca-t:#B45309;--_lo-t:#BE123C;--_qtr:rgba(15,23,42,.11);--_pb:linear-gradient(135deg,rgba(236,72,153,.22),rgba(168,85,247,.24) 36%,rgba(56,189,248,.22) 70%,rgba(16,185,129,.2));--_cs:linear-gradient(160deg,rgba(255,255,255,.96),rgba(248,250,255,.95));--_qa:linear-gradient(135deg,rgba(254,246,251,.97),rgba(247,245,255,.97) 48%,rgba(241,250,255,.97));--_cm:rgba(15,23,42,.038);--_mp:rgba(15,23,42,.05);--_vw:rgba(241,245,249,.72);--_vws:inset 0 1px 0 rgba(255,255,255,.85)}:host([hidden]),.sub-badge[hidden],.card[hidden],.footnote[hidden],.footnote:empty,.q-trk[hidden],.q-sep[hidden],.q-5-txt[hidden],.q-w-txt[hidden],:host([data-layout="blocked"])>.bar{display:none!}:host([data-layout="blocked"]){position:fixed!;left:-9999px!;top:-9999px!;width:0!;height:0!;margin:0!;padding:0!;overflow:hidden!;visibility:hidden!;pointer-events:none!}.bar{gap:1.5px}:host([data-ag-prism-fallback="1"]) .bar{gap:1px!}.chip{gap:3px;height:24px;padding:0 4px;border:0;$66px;$7transparent;color:inherit;font:inherit;cursor:pointer;font-variant-numeric:tabular-nums;transition:background .15s,color .15s}:host([data-ag-prism-fallback="1"]) .bar .chip{padding:0 3.5px!;gap:2.5px!}:host([data-ag-prism-fallback="1"]:not(.icons-only)) .bar .chip:not([hidden])~.chip:not([hidden]){margin-left:3.5px!}:host([data-ag-prism-fallback="1"]:not(.icons-only)) .bar .chip:not([hidden])~.chip:not([hidden])::before{left:-2px!}.chip:hover,.chip[aria-expanded="true"]{$7rgba(128,138,158,.12)}.bar .chip:focus,.card button:focus{outline:none!}.bar .chip:focus-visible,.card button:focus-visible{outline:none!;box-shadow:0 0 0 2px rgba(168,85,247,.38),0 0 0 3.5px rgba(56,189,248,.22)!}.chip svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.5;fill:none;opacity:.85;flex:none}.dim{color:var(--_dm);opacity:1;font-size:10.5px}.sub-badge{font-size:10.5px;opacity:1;color:var(--_sb);font-weight:600}.chip[data-card="context"][data-caution="1"]{$7rgba(217,119,6,.12);color:var(--_ca-t)}.bar .chip[data-card="quota"]{gap:3.5px!;padding:0 3.5px!}.bar .chip[data-card="quota"] .quota-bars{display:inline-flex;flex-direction:column;justify-content:center;gap:1.5px;width:18px;height:7px;flex:none}.bar .chip[data-card="quota"] .q-trk{display:flex;width:100%;height:3px;$6999px;$7var(--_qtr);overflow:hidden}.bar .chip[data-card="quota"] .q-trk-5{height:2.5px}.bar .chip[data-card="quota"] .quota-bars[data-single="1"] .q-trk{height:4px}.bar .chip[data-card="quota"] .q-trk>i{display:block;height:100%;width:0%;$6999px;$7var(--_rb);transition:width .24s ease}.bar .chip[data-card="quota"] .q-trk>i[data-level="tight"]{$7var(--_rbt)}.bar .chip[data-card="quota"] .q-trk>i[data-level="low"]{$7var(--_rbl)}.bar .chip[data-card="quota"] .quota-txt{display:inline-flex;align-items:baseline;gap:2px;font-size:10.5px;letter-spacing:-.015em;font-variant-numeric:tabular-nums}.bar .chip[data-card="quota"] .q-w-txt{font-weight:600;color:var(--_fg)}.bar .chip[data-card="quota"] .q-w-txt[data-level="tight"]{color:var(--_ca-t)}.bar .chip[data-card="quota"] .q-w-txt[data-level="low"]{color:var(--_lo-t)}.bar .chip[data-card="quota"] .q-sep{color:var(--_dm);opacity:.48;font-size:9.5px}.bar .chip[data-card="quota"] .q-5-txt{font-weight:500;font-size:10px;color:var(--_dm);opacity:1}.bar .chip[data-card="quota"] .q-5-txt[data-level="tight"]{font-weight:600;color:var(--_ca-t)}.bar .chip[data-card="quota"] .q-5-txt[data-level="low"]{font-weight:600;color:var(--_lo-t)}.context-ring{width:11px;height:11px;$650%;$7conic-gradient(var(--pv-tint,#3186ff) var(--used-angle,36deg),rgba(148,163,184,.28) 0);display:inline-block;position:relative;flex:none}.context-ring::after{content:"";position:absolute;inset:2.2px;$650%;$7var(--card,#141720)}.card{position:absolute;right:0;left:auto;bottom:calc(100% + 10px);width:min(304px,calc(100vw - 24px));padding:13px 14px;$614px;border:1px solid transparent;$7var(--_cs) padding-box,var(--_pb) border-box;color:var(--_fg);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%);box-shadow:0 18px 46px rgba(0,0,0,.44),0 0 18px rgba(168,85,247,.08),inset 0 1px 0 rgba(255,255,255,.07);z-index:9999}.card::after{content:"";position:absolute;left:-6px;right:-6px;top:100%;height:14px;$7transparent}:host-context(html[data-ag-cs-theme="light"]) .card,:host-context(.light) .card,:host([data-pv-light="1"]) .card{box-shadow:0 16px 40px rgba(15,23,42,.11),0 2px 10px rgba(139,92,246,.05),inset 0 1px 0 rgba(255,255,255,.92)}$14"]) .card{right:-84px;width:min(296px,calc(100vw - 32px))}.heading{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11.5px;font-weight:600;margin-bottom:7px}.heading>span:first-child{white-space:nowrap}.q-head-model{font-size:10px;font-weight:500;color:var(--_dm);padding:2px 8px;$6999px;border:0;$7var(--_mp);$4text-overflow:ellipsis;max-width:176px}.q-head-model:empty{display:none}.ctx-hero{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px}.ctx-hero-l{display:inline-flex;align-items:baseline;gap:4px;min-width:0}#context-summary{display:inline;font-size:15px;font-weight:700;letter-spacing:-.025em;color:var(--_fg)}.ctx-rem{font-size:11px;font-weight:500;color:var(--_dm)}#context-tokens{margin:0;font-size:10.5px;font-weight:500;color:var(--_dm);font-variant-numeric:tabular-nums;white-space:nowrap}.track{height:5px;$6999px;$7var(--_qtr);overflow:hidden;margin:4px 0 8px}.track>i{display:block;height:100%;width:0%;$6999px;$7var(--_rb)}.ctx-legend{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 0 8px;font-size:10px;color:var(--_dm);font-variant-numeric:tabular-nums}.ctx-leg{display:inline-flex;align-items:center;gap:4px;min-width:0;white-space:nowrap}.ctx-leg b{font-weight:600;color:var(--_fg)}.ctx-dot{width:6px;height:6px;$650%;flex:none}.ctx-d0{$7#EC4899}.ctx-d1{$7#8B5CF6}.ctx-d2{$7#10B981}.ctx-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px}.ctx-mcard{display:flex;flex-direction:column;gap:2px;padding:6.5px 9px;$69px;border:0;$7var(--_cm);transition:background .15s}.ctx-mcard[data-clickable="1"]{cursor:pointer}.ctx-mcard[data-clickable="1"]:hover{$7var(--_mp)}.ctx-mlbl{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:10px;color:var(--_dm);font-weight:500}.ctx-mtag{font-size:8.5px;font-weight:600;letter-spacing:.04em;opacity:.68}.ctx-mval{font-size:12px;font-weight:650;color:var(--_fg);font-variant-numeric:tabular-nums;$4text-overflow:ellipsis}.ctx-mval-row{display:flex;align-items:baseline;gap:4px;min-width:0}.ctx-msub{font-size:9.5px;font-weight:500;color:var(--_dm);$4text-overflow:ellipsis}.ctx-mval[data-level="tight"]{color:var(--_ca-t)}.ctx-mval[data-level="low"]{color:var(--_lo-t)}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;margin:8px 0;font-size:11px}dt{color:var(--_dm);opacity:1}dd{margin:0;text-align:right;font-weight:500;$4text-overflow:ellipsis}.ctx-model-dl{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding-top:2px;border-top:0}.ctx-model-dl dt{font-size:10.5px;font-weight:500;color:var(--_dm)}.ctx-model-dl dd{max-width:190px;padding:2.5px 9px;$6999px;font-size:10.5px;font-weight:600;color:var(--_fg);border:0;$7var(--_mp)}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode]{border:1px solid transparent!;$7var(--_cs) padding-box,var(--_pb) border-box!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"]{width:min(396px,calc(100vw - 24px))!;padding:13px 14px 13px 106px!;min-height:244px!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"]:not([hidden]){display:flex!;flex-direction:column;justify-content:space-between}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-rail{width:88px!;left:9px!;top:12px!;bottom:12px!;padding:0!;border-right:0!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-well{height:100%;justify-content:space-between;padding:7px 4px!;$610px!;border:0!;$7var(--_vw)!;box-shadow:var(--_vws)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-slot,:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-cv{width:76px!;height:174px!;min-width:76px!;min-height:174px!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-ft{font-size:0!;line-height:1.2;color:var(--_dm)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode="vial"] .pv-ft::after{content:var(--vial-foot,attr(data-vial-foot));font-size:10px;font-weight:500;letter-spacing:-.01em}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-bw{margin:1px 0 5px!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-trk{height:6px!;$7var(--_qtr)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-seg[data-layer-slice="0"]{$7linear-gradient(90deg,#EC4899,#F472B6)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-seg[data-layer-slice="1"]{$7linear-gradient(90deg,#8B5CF6,#38BDF8)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-seg[data-layer-slice="2"]{$7linear-gradient(90deg,#38BDF8,#34D399)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-tl{display:none!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-bw:has(.pv-seg[data-hover="1"]) .pv-tl{display:flex!;margin-top:2px}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-tl [data-ag-pulse-capacity="1"]{display:none!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-btn{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;$6999px;border:1px solid rgba(139,92,246,.2)!;$7rgba(139,92,246,.06)!}:host([data-ag-prism-fallback="1"]) #context-card[data-ag-pulse-vial-mode] .pv-btn::before{content:"";width:5.5px;height:5.5px;$650%;$7linear-gradient(135deg,#EC4899,#8B5CF6 50%,#38BDF8);flex:none}.q-list{display:flex;flex-direction:column;gap:7px;margin:6px 0 8px}.q-row{display:flex;flex-direction:column;gap:6px;padding:8px 10px;$610px;border:0;$7var(--_cm);font-size:11px;color:inherit;width:100%;cursor:pointer;text-align:left;transition:background .16s,border-color .16s,box-shadow .16s,filter .16s}.q-row:hover{$7var(--_mp)}.q-row.q-active{border:1px solid transparent;$7var(--_qa) padding-box,var(--_pb) border-box;box-shadow:0 4px 14px rgba(139,92,246,.06)}.q-row.q-active:hover{$7var(--_qa) padding-box,var(--_pb) border-box;border-color:transparent;filter:brightness(1.015)}.q-top{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%}.q-name-wrap{display:inline-flex;align-items:center;gap:6px;min-width:0}.q-name{font-weight:650;$4text-overflow:ellipsis}.q-tag{font-size:9.5px;font-weight:600;padding:1px 6px;$6999px;$7linear-gradient(110deg,#EC4899,#8B5CF6 55%,#0EA5E9);color:#fff;flex:none;letter-spacing:.01em}.q-val{font-weight:700;font-variant-numeric:tabular-nums;color:var(--_fg);flex:none}.q-val[data-level="tight"]{color:var(--_ca-t)}.q-val[data-level="low"]{color:var(--_lo-t)}.q-wins{display:flex;flex-direction:column;gap:5px;width:100%}.q-win{display:flex;flex-direction:column;gap:3px;width:100%}.q-win-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;color:var(--_dm);font-variant-numeric:tabular-nums}.q-bar{width:100%;height:5px;$6999px;$7var(--_qtr);overflow:hidden}.q-bar.q-bar-sm{height:4px}.q-bar>i{display:block;height:100%;$6999px;$7var(--_rb);transition:width .24s ease}.q-row:not(.q-active) .q-bar>i{opacity:.76}.q-bar>i[data-level="tight"]{$7var(--_rbt);opacity:1}.q-bar>i[data-level="low"]{$7var(--_rbl);opacity:1}.act-btn{margin-top:4px;width:100%;height:28px;padding:0 10px;$69px;border:1px solid rgba(139,92,246,.2);$7var(--_cm);color:var(--_fg);font:600 11px/1 inherit;cursor:pointer;transition:border-color .16s,background .16s,box-shadow .16s}.act-btn:hover{border-color:rgba(168,85,247,.42);$7var(--_mp);box-shadow:0 2px 10px rgba(139,92,246,.1)}.footnote{margin:6px 0 0;font-size:10.5px;color:var(--_dm);opacity:1}') + TIER_CSS;

  const isFin = (v) => typeof v === 'number' && Number.isFinite(v);
  const FB_ROWS = {
    'zh-CN': '缓存|吞吐速率|首字延迟|最近速率|上下文窗口|当前模型|已用|剩余|代理|缓存与子代理|命中率|累计节省|活跃子代理|会话总计|轮次/耗时|用量分布|模型配额|切换模型|查看子代理面板|余量|当前|后重置|周|周额度|5h 窗口|生成速率|系统|对话|工具|缓存命中|距压缩线|省|剩|已达预警|峰值',
    'zh-TW': '快取|吞吐速率|首字延遲|最近速率|上下文視窗|目前模型|已用|剩餘|代理|快取與子代理|命中率|累計節省|活躍子代理|會話總計|輪次/耗時|用量分布|模型配額|切換模型|檢視子代理面板|餘量|目前|後重設|週|週額度|5h 視窗|生成速率|系統|對話|工具|快取命中|距壓縮線|省|剩|已達預警|峰值',
    yue: '快取|吞吐速率|首字延遲|最近速率|上下文視窗|目前模型|已用|剩低|代理|快取同子代理|命中率|累計慳咗|活躍子代理|會話總計|輪次/耗時|用量分布|模型配額|切換模型|睇子代理面板|餘量|而家|後重設|週|週額度|5h 視窗|生成速率|系統|對話|工具|快取命中|距壓縮線|慳|剩|已達預警|峰值',
    en: 'Cache|Throughput|TTFT|Latest Rate|Context Window|Active Model|used|free| sub|Cache & Subagents|Hit Rate|Total Saved|Subagents|Session Total|Rounds / Time|Token Split|Model Quota|Switch Model|Inspect Subagents|Quota|Active|resets in|7d|Weekly|5h Window|Gen Rate|System|Msgs|Tools|Cache Hit|To Compact|saved|left|At Limit|Peak',
    ja: 'キャッシュ|スループット|初回応答|最新速度|コンテキスト|現在のモデル|使用|残り| sub|キャッシュとサブ|ヒット率|累計節約|サブエージェント|セッション計|回数/所要|内訳|モデル残量|モデル切替|サブ一覧を開く|残量|使用中|後に更新|週|週間枠|5h 枠|生成速度|システム|会話|ツール|キャッシュ|圧縮まで|節約|残|圧縮推奨|最高',
  };
  const FB_I18N = Object.fromEntries(
    Object.entries(FB_ROWS).map(([lk, s]) => {
      const r = s.split('|');
      return [
        lk,
        {
          lang: lk,
          cache: r[0], speedHeading: r[1], ttft: r[2], latestRate: r[3],
          ctxHeading: r[4], curModel: r[5],
          usedTxt: (p) => `${p}% ${r[6]}`,
          remPart: (rem) => `· ${rem}% ${r[7]}`,
          summary: (p, rem) => `${p}% ${r[6]} · ${rem}% ${r[7]}`,
          agents: (n) => `· ${n}${r[8]}`,
          cacheHeading: r[9], hitRate: r[10], savedTok: r[11], activeSubs: r[12], totalTok: r[13],
          elapsed: r[14], tokSplit: r[15], quotaHeading: r[16], switchModel: r[17], openSubs: r[18],
          quotaShort: r[19], curPool: r[20],
          resetFmt: (eta) => !eta ? '' : (lk === 'en' ? `${r[21]} ${eta}` : `${eta}${r[21]}`),
          remFmt: (p) => (lk === 'en' ? `${p}% left` : `${r[7]} ${p}%`),
          weekShort: r[22], weekLbl: r[23], fiveLbl: r[24], genRate: r[25],
          sliceSys: r[26], sliceMsg: r[27], sliceTool: r[28],
          cacheHit: r[29], toCompact: r[30],
          savedShort: (s0) => (lk === 'en' ? `${s0} ${r[31]}` : `${r[31]} ${s0}`),
          leftShort: (s0) => (lk === 'en' ? `${s0} ${r[32]}` : `${r[32]} ${s0}`),
          vialRem: (s0) => (lk === 'en' ? `${s0} ${r[7]}` : `${r[7]} ${s0}`),
          atLimit: r[33],
          peakShort: (v) => `${r[34]} ${v}`,
        },
      ];
    })
  );

  function fmtTok(n) {
    if (!isFin(n) || n < 0) return '—';
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
    return String(Math.round(n));
  }

  function mk(doc, tag, attrs, kids) {
    const el = doc.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'text') el.textContent = String(v);
        else if (k === 'cls') el.className = String(v);
        else if (k === 'hidden') el.hidden = Boolean(v);
        else el.setAttribute(k, String(v));
      }
    }
    if (kids) for (const c of kids) if (c) el.appendChild(c);
    return el;
  }

  let reqSeq = 0;

  function createTelemetryController(envOpts) {
    const gW = () => (envOpts && envOpts.window) || (typeof window !== 'undefined' ? window : globalRoot);
    const gD = () => (envOpts && envOpts.document) || gW()?.document || null;

    let mode = 'auto', waitTm = null, rescTm = null, pollTm = null, fbEl = null, srEl = null;
    let hasHost = false, yielded = false, lastSig = '', detAt = 0;
    let docOff = null, keyOff = null, popOff = null, lastSnap = null, mApi = null, mRes = null, seatObs = null, healTm = null;
    let locSnap = null, locAt = 0, expLang = '';
    let lastModelLbl = '', modelSyncTm = null, hoverOpenTm = null, hoverCloseTm = null, lastProc = false, lastRounds = 0, lastQuotaSyncAt = 0;
    let tierRo = null, tierEl = null, tierRaf = 0, curTier = 0, pendTierW = 0, hasPendTierW = false, lastTv = '', lastFtW = 0, qComp = false, winResOff = null;
    let winBlur = false, pollSusp = false, blurOff = null, blurObs = null;
    const pend = new Map();

    const TIER_CUTS = [640, 515, 450, 395, 345], FT_SEL = '.agy-composer-footer,[data-testid="input-box-bottom-toolbar"]';
    const syncQCompact = (w) => {
      if (isFin(w) && w > 0) lastFtW = w;
      if (!fbEl || !isFin(lastFtW) || lastFtW <= 0) return;
      const mLen = lastModelLbl ? lastModelLbl.length : 0;
      const cut = mLen > 24 ? 730 : 690;
      const next = qComp ? lastFtW < cut + 14 : lastFtW < cut;
      if (next !== qComp || (next ? fbEl.getAttribute?.('data-q-compact') !== '1' : fbEl.hasAttribute?.('data-q-compact'))) {
        qComp = next;
        if (next) fbEl.setAttribute?.('data-q-compact', '1');
        else fbEl.removeAttribute?.('data-q-compact');
      }
    };
    const clrTier = () => {
      try { if (tierRaf) gW()?.cancelAnimationFrame?.(tierRaf); tierRo?.disconnect(); winResOff?.(); tierEl?.removeAttribute?.(TIER_ATTR); } catch {}
      tierRaf = 0; tierRo = winResOff = tierEl = null; curTier = 0; pendTierW = 0; hasPendTierW = false; lastTv = ''; lastFtW = 0; qComp = false;
      for (const b of gD()?.querySelectorAll?.(`#${PRISM_BAR_ID},[${PRISM_BAR_ATTR}],#${BAR_ID},[id^="${BAR_ID}"],[data-ag-pulse-bar]`) || []) {
        try { b.removeAttribute?.(TIER_ATTR); b.removeAttribute?.('data-q-compact'); b.shadowRoot?.querySelector?.(`style[${TIER_STYLE_ATTR}="1"]`)?.remove?.(); } catch {}
      }
    };
    const applyTierNow = (force = false) => {
      tierRaf = 0;
      const doc = gD(), ft = mode !== 'off' && (tierEl?.isConnected ? tierEl : doc?.querySelector?.(FT_SEL));
      const w = hasPendTierW ? pendTierW : ft?.getBoundingClientRect?.().width;
      pendTierW = 0;
      hasPendTierW = false;
      if (!ft || !isFin(w) || w <= 0) return;
      syncQCompact(w);
      let t = curTier;
      while (t < 5 && w < TIER_CUTS[t]) t++;
      while (t > 0 && w >= TIER_CUTS[t - 1] + 12) t--;
      const tv = TIER_VALS[(curTier = t)] || '0';
      if (!force && tv === lastTv && ft.getAttribute?.(TIER_ATTR) === tv) return;
      lastTv = tv;
      if (ft.getAttribute?.(TIER_ATTR) !== tv) ft.setAttribute?.(TIER_ATTR, tv);
      for (const b of fbEl ? [fbEl, ...findExtBars(doc)] : findExtBars(doc)) {
        if (!b || b.getAttribute?.(HID_ATTR) === '1') continue;
        if (b.getAttribute?.(TIER_ATTR) !== tv) b.setAttribute?.(TIER_ATTR, tv);
        if (b !== fbEl && b.shadowRoot && !b.shadowRoot.querySelector?.(`style[${TIER_STYLE_ATTR}="1"]`)) {
          try { const st = doc.createElement('style'); st.setAttribute(TIER_STYLE_ATTR, '1'); st.textContent = TIER_CSS; b.shadowRoot.appendChild(st); } catch {}
        }
      }
    };
    const schedTier = (entries) => {
      if (entries && typeof entries.length === 'number') {
        let rw = NaN;
        for (let i = entries.length - 1; i >= 0; i--) {
          const w0 = entries[i]?.contentRect?.width;
          if (isFin(w0) && w0 >= 0) { rw = w0; break; }
        }
        if (isFin(rw)) { pendTierW = rw; hasPendTierW = true; }
      } else {
        hasPendTierW = false;
      }
      if (!tierRaf && mode !== 'off') { const w = gW(); tierRaf = w?.requestAnimationFrame ? w.requestAnimationFrame(() => applyTierNow(false)) : (applyTierNow(false), 0); }
    };
    const ensTierObs = () => {
      const w = gW(), ft = mode !== 'off' && gD()?.querySelector?.(FT_SEL);
      if (!w || !ft) return;
      const changed = tierEl !== ft;
      if (changed) {
        try { tierRo?.disconnect(); } catch {} tierRo = null; tierEl = ft; lastTv = '';
        if (typeof w.ResizeObserver === 'function') { try { tierRo = new w.ResizeObserver(schedTier); tierRo.observe(ft); } catch {} }
      }
      if (!winResOff && typeof w.addEventListener === 'function') { const onR = () => schedTier(null); w.addEventListener('resize', onR, { passive: true }); winResOff = () => w.removeEventListener?.('resize', onR); }
      if (changed || !lastTv || !tierRo) applyTierNow(true);
    };

    const bindHook = () => {
      const w = gW();
      if (!w) return;
      if (!mRes) {
        mRes = (id, pl) => {
          const it = pend.get(id);
          if (!it) return;
          clearTimeout(it.timer);
          pend.delete(id);
          if (pl && pl.connection !== 'local-estimate' && pl.groups?.length > 0) {
            const keepSpeed = !pl.speed && lastSnap?.speed;
            const keepConvs = !pl.conversations?.length && lastSnap?.conversations?.length;
            lastSnap = keepSpeed || keepConvs
              ? { ...pl, ...(keepSpeed ? { speed: lastSnap.speed } : {}), ...(keepConvs ? { conversations: lastSnap.conversations } : {}) }
              : pl;
          }
          it.resolve(pl);
        };
      }
      if (w.__agPrismMetricsResolve !== mRes) w.__agPrismMetricsResolve = mRes;
    };

    const clrWait = () => {
      if (waitTm !== null) { clearTimeout(waitTm); waitTm = null; }
      if (rescTm !== null) { clearTimeout(rescTm); rescTm = null; }
    };
    const clrPoll = () => {
      if (pollTm !== null) { clearInterval(pollTm); pollTm = null; }
    };
    const isBlur = () => { const d = gD(); return Boolean(d?.hidden || d?.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1' || winBlur); };
    const clrBlur = () => { try { blurOff?.(); blurObs?.disconnect?.(); } catch {} blurOff = blurObs = null; winBlur = pollSusp = false; };
    const startPoll = () => {
      clrPoll();
      if (!fbEl || mode === 'off') return;
      if (isBlur()) { pollSusp = true; return; }
      pollSusp = false;
      pollTm = setInterval(() => { isBlur() ? (pollSusp = true, clrPoll()) : void refresh(); }, 4000);
      pollTm?.unref?.();
    };
    const syncBlur = (res) => {
      if (!fbEl || mode === 'off') { clrPoll(); pollSusp = false; return; }
      if (isBlur()) { pollSusp = true; clrPoll(); return; }
      const was = pollSusp; pollSusp = false;
      if (pollTm === null) startPoll();
      if (was && res) void refresh();
    };
    const ensBlur = () => {
      const w = gW(), d = gD();
      if (!w || !d) return;
      if (!blurOff && typeof w.addEventListener === 'function') {
        const onB = () => { winBlur = true; syncBlur(false); }, onF = () => { winBlur = false; syncBlur(true); }, onV = () => { if (!gD()?.hidden) winBlur = false; syncBlur(!gD()?.hidden); };
        w.addEventListener('blur', onB); w.addEventListener('focus', onF); d.addEventListener?.('visibilitychange', onV);
        blurOff = () => { w.removeEventListener?.('blur', onB); w.removeEventListener?.('focus', onF); d.removeEventListener?.('visibilitychange', onV); };
      }
      if (!blurObs && typeof w.MutationObserver === 'function' && d.documentElement) {
        try { blurObs = new w.MutationObserver(() => { const b = gD()?.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1'; if (!b) winBlur = false; syncBlur(!b); }); blurObs.observe(d.documentElement, { attributes: true, attributeFilter: ['data-ag-cs-win-blur'] }); } catch {}
      }
    };
    const clrSeat = () => {
      if (healTm !== null) { clearTimeout(healTm); healTm = null; }
      if (seatObs) { try { seatObs.disconnect(); } catch {} seatObs = null; }
      if (popOff) { try { popOff(); } catch {} popOff = null; }
      clrTier();
    };

    const isConv = (doc, w, anc) => {
      if (!doc || anc?.closest?.('.agy-home') || doc.querySelector?.('.agy-home, [data-testid="home-greeting"]')) return false;
      const pn = w?.location?.pathname;
      if (typeof pn === 'string' && pn && !/\/c\/[0-9a-f-]{8,}/i.test(pn)) {
        if (!doc.querySelector?.('[data-testid="conversation-view"]') && !anc?.closest?.('[data-cascade-id]') && !doc.querySelector?.('[data-cascade-id]')) {
          return false;
        }
      }
      return true;
    };

    const HIDE_PROPS = 'position:fixed|left:-9999px|top:-9999px|width:1px|height:1px|opacity:0|pointer-events:none|visibility:hidden|overflow:hidden'.split('|').map((s) => s.split(':'));

    const findExtBars = (doc) => {
      if (!doc) return [];
      const seen = new Set(), out = [], add = (el) => { if (el && !seen.has(el)) { seen.add(el); out.push(el); } };
      if (typeof doc.querySelectorAll === 'function') {
        try {
          const s = doc.querySelectorAll('#' + BAR_ID + ',[id^="' + BAR_ID + '"],[data-ag-pulse-bar="true"]');
          for (let i = 0; i < s.length; i++) add(s[i]);
        } catch {}
      }
      if (typeof doc.getElementById === 'function') add(doc.getElementById(BAR_ID));
      return out;
    };

    const purgeOrphans = (doc, keep = null) => {
      if (!doc || typeof doc.querySelectorAll !== 'function') return;
      const list = doc.querySelectorAll('[' + FALLBACK_ATTR + '="1"], #' + PRISM_BAR_ID + ', [' + PRISM_BAR_ATTR + '="true"]');
      for (let i = 0; i < list.length; i++) {
        if (list[i] !== keep) try { list[i].remove(); } catch {}
      }
    };

    const isConn = (doc, el) => {
      if (!el || el.isConnected === false) return false;
      if (el.isConnected === true) return true;
      if (!el.parentNode && !el.parentElement) return false;
      if (doc && typeof doc.getElementById === 'function' && el.id && typeof doc.querySelectorAll !== 'function') {
        const b = doc.getElementById(el.id);
        if (b && b !== el) return false;
      }
      return true;
    };

    const usableExt = (doc, b) => {
      if (!b || b.getAttribute?.(FALLBACK_ATTR) === '1' || !isConn(doc, b)) return false;
      if (b.getAttribute?.(HID_ATTR) === '1' || b.getAttribute?.('data-layout') === 'blocked' || b.hidden === true) return false;
      if (b.style && b.style.display === 'none') return false;
      if (doc && doc.body && (b.parentElement === doc.body || b.parentNode === doc.body)) return false;
      if (b.closest?.('.agy-home')) return false;
      return true;
    };

    let extGuardHeld = false;

    const hasExt = (barsArg, knownConv = false) => {
      const w = gW(), doc = gD();
      if (!w || !doc || (!knownConv && !isConv(doc, w))) return false;
      const bars = barsArg || findExtBars(doc);
      let sawDead = false;
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (!b || b.getAttribute?.(FALLBACK_ATTR) === '1' || !isConn(doc, b) || b.getAttribute?.(HID_ATTR) === '1') continue;
        if (usableExt(doc, b)) { detAt = 0; return true; }
        sawDead = true;
      }
      if (sawDead) return false;
      const sig = [
        w.__agPulseRuntimeOwner ? String(w.__agPulseRuntimeOwner) : '',
        w.__agPulseRuntimeBridge ? 'b' : '',
        w.__agPulseInlineInstalled && !extGuardHeld ? '1' : '',
        w.agPulseHost && !w.agPulseHost.__prismFallback ? 'h' : '',
      ].join('|');
      if (sig !== '|||') {
        const now = Date.now();
        if (sig !== lastSig) { lastSig = sig; detAt = now; return true; }
        if (!detAt) detAt = now;
        return now - detAt < GRACE_MS;
      }
      lastSig = '';
      detAt = 0;
      return false;
    };

    const showExt = () => {
      if (extGuardHeld) {
        extGuardHeld = false;
        const w = gW();
        if (w && !w.__agPulseDispose) w.__agPulseInlineInstalled = false;
      }
      const bars = findExtBars(gD());
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (b && b.getAttribute?.(HID_ATTR) === '1') {
          b.removeAttribute(HID_ATTR);
          if (b.style) {
            if (typeof b.style.removeProperty === 'function') {
              b.style.removeProperty('display');
              for (let j = 0; j < HIDE_PROPS.length; j++) b.style.removeProperty(HIDE_PROPS[j][0]);
            } else {
              b.style.opacity = '';
              b.style.position = '';
              b.style.pointerEvents = '';
            }
          }
        }
      }
    };

    const hideExt = (disposeExt = false) => {
      if (disposeExt) {
        const w = gW();
        if (w) {
          try { w.__agPulseDispose?.(); } catch {}
          w.__agPulseInlineInstalled = true;
          extGuardHeld = true;
        }
      }
      const bars = findExtBars(gD());
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (b && b.getAttribute?.(FALLBACK_ATTR) !== '1') {
          b.setAttribute(HID_ATTR, '1');
          if (b.style) {
            b.style.removeProperty?.('display');
            if (typeof b.style.setProperty === 'function') {
              for (let j = 0; j < HIDE_PROPS.length; j++) b.style.setProperty(HIDE_PROPS[j][0], HIDE_PROPS[j][1], 'important');
            } else {
              b.style.position = 'fixed';
              b.style.left = '-9999px';
              b.style.opacity = '0';
              b.style.pointerEvents = 'none';
            }
          }
        }
      }
    };

    const ensBridge = () => {
      const w = gW();
      if (!w) return;
      bindHook();
      if (!mApi) {
        mApi = { __prismOwned: true, getMetrics: (inp) => reqSnap(inp), getLatestSnapshot: () => lastSnap };
      }
      w.__agPrismMetricsBridge = mApi;
    };

    const rmHost = () => {
      const w = gW();
      if (hasHost && w?.agPulseHost?.__prismFallback) delete w.agPulseHost;
      hasHost = false;
    };

    const ensHost = () => {
      const w = gW();
      if (!w) return;
      ensBridge();
      if (!w.agPulseHost || typeof w.agPulseHost.getMetrics !== 'function') {
        w.agPulseHost = {
          __prismFallback: true,
          getMetrics: (inp) => reqSnap(inp),
          getLatestSnapshot: () => lastSnap,
          getPreferences: () => Promise.resolve({ language: 'zh-CN' }),
          setPreferences: (v) => Promise.resolve(v || {}),
          report: () => {},
        };
        hasHost = true;
      }
    };

    const clrHover = () => {
      if (hoverOpenTm !== null) { clearTimeout(hoverOpenTm); hoverOpenTm = null; }
      if (hoverCloseTm !== null) { clearTimeout(hoverCloseTm); hoverCloseTm = null; }
    };
    const unmountFb = (keepBridge = false) => {
      clrWait();
      clrPoll();
      clrBlur();
      clrHover();
      if (modelSyncTm !== null) { clearTimeout(modelSyncTm); modelSyncTm = null; }
      if (docOff) { try { docOff(); } catch {} docOff = null; }
      if (keyOff) { try { keyOff(); } catch {} keyOff = null; }
      if (!keepBridge) {
        clrSeat();
        for (const it of pend.values()) { clearTimeout(it.timer); it.resolve(null); }
        pend.clear();
        rmHost();
      }
      if (fbEl) {
        try {
          if (srEl) {
            for (const cid of ['context-card', 'speed-card', 'cache-card', 'quota-card']) {
              const el = srEl.getElementById?.(cid);
              if (el) el.hidden = true;
            }
          }
          const w0 = gW();
          w0?.__agPulseExternalBridge?.({ event: 'dispose' });
          const CE = w0?.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
          if (CE) {
            w0?.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail: { open: false, cards: [] } }));
            gD()?.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail: { open: false, cards: [] } }));
          }
        } catch {}
        try { fbEl.remove(); } catch {}
      }
      purgeOrphans(gD(), null);
      fbEl = null;
      srEl = null;
    };

    const detCid = (node) => {
      try {
        const cid = node?.closest?.('[data-cascade-id]')?.getAttribute?.('data-cascade-id');
        if (cid && GUID_RE.test(cid)) return cid;
        const m = gW()?.location?.pathname?.match?.(/\/c\/([0-9a-f-]{36})/i);
        return m ? m[1] : null;
      } catch { return null; }
    };

    const estSnap = () => {
      const now = Date.now();
      if (locSnap && now - locAt < 5000) return locSnap;
      const doc = gD();
      let model = 'Gemini 4', chars = 0;
      try {
        const tr = doc?.querySelector?.('[data-testid="model-selector-trigger"]');
        const lb = tr?.getAttribute?.('aria-label') || tr?.textContent?.trim();
        if (lb) model = lb;
        const vw = doc?.querySelector?.('[data-testid="conversation-view"]');
        if (vw && typeof vw.querySelectorAll === 'function') {
          const ts = vw.querySelectorAll('[data-testid="planner-response-text"],[data-testid="agent-response"],[data-testid="user-message-bubble"]');
          if (ts?.length > 0) {
            const n = Math.min(4, ts.length);
            let s = 0;
            for (let i = ts.length - n; i < ts.length; i++) s += (ts[i].textContent || '').length;
            chars = Math.round((s / n) * ts.length);
          }
        } else if (typeof vw?.textContent === 'string') chars = vw.textContent.length;
      } catch {}
      const maxTokens = 512000, usedTokens = Math.max(4200, Math.min(maxTokens, Math.round(chars / 3.2) + 8400));
      const usedFraction = Math.min(0.98, usedTokens / maxTokens);
      locAt = now;
      locSnap = {
        connection: 'local-estimate',
        speed: { model, tps: null, latestTps: null, ttftSeconds: null, rounds: 0, cacheHitRate: null, totalTokens: usedTokens, context: { model, usedTokens, maxTokens, usedFraction, sampledAt: now } },
        groups: [],
      };
      return locSnap;
    };

    const reqSnap = (inp) => {
      const w = gW();
      bindHook();
      const si = inp && typeof inp === 'object' ? { ...inp } : {};
      if (si.usageSync) delete si.usageSync;
      if (w && typeof w[METRICS_BINDING] === 'function') {
        return new Promise((resolve) => {
          if (pend.size >= 6) { resolve(lastSnap || estSnap()); return; }
          const id = ++reqSeq;
          const timeoutMs = si.force || si.quotaRefresh ? 10000 : 4500;
          const timer = setTimeout(() => { pend.delete(id); resolve(lastSnap || estSnap()); }, timeoutMs);
          pend.set(id, { resolve, timer });
          try {
            w[METRICS_BINDING](JSON.stringify({ id, input: si }));
          } catch {
            clearTimeout(timer);
            pend.delete(id);
            resolve(lastSnap || estSnap());
          }
        });
      }
      return Promise.resolve(estSnap());
    };

    const readLiveModel = (doc, fallback) => {
      try {
        const tr = doc?.querySelector?.('[data-testid="model-selector-trigger"]');
        const txt = tr?.textContent?.trim();
        if (txt) return txt;
        const aria = tr?.getAttribute?.('aria-label') || '';
        const m = aria.match(/current:\s*(.+)$/i);
        if (m && m[1].trim()) return m[1].trim();
        if (aria.trim()) return aria.trim();
      } catch {}
      return fallback || 'Antigravity Model';
    };
    const normModelKey = (raw) => String(raw || '')
      .toLowerCase()
      .replace(/^select model,\s*current:\s*/i, '')
      .replace(/\b(?:extra\s+high|xhigh|high|medium|med|low|minimal|fast|thinking|off)\b/g, ' ')
      .replace(/[()\[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fmtResetEta = (bk, lang, uCore) => {
      const raw = bk?.resetAt ?? bk?.resetTime;
      if (raw == null) return '';
      const ms = typeof raw === 'number' ? (raw > 1e11 ? raw : raw * 1000) : Date.parse(String(raw));
      if (!Number.isFinite(ms)) return '';
      const left = ms - Date.now();
      if (left <= 0) return '';
      if (typeof uCore?.shortEta === 'function') return uCore.shortEta(left, lang);
      const sec = Math.max(1, Math.round(left / 1000));
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
      if (lang === 'en') return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
      if (lang === 'ja') return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${m}分` : `${Math.max(1, m)}分`;
      if (lang === 'yue') return d > 0 ? `${d}日${h}個鐘` : h > 0 ? `${h}個鐘${m}分` : `${Math.max(1, m)}分鐘`;
      if (lang === 'zh-TW') return d > 0 ? `${d}天${h}小時` : h > 0 ? `${h}小時${m}分` : `${Math.max(1, m)}分鐘`;
      return d > 0 ? `${d}天${h}小时` : h > 0 ? `${h}小时${m}分` : `${Math.max(1, m)}分钟`;
    };
    const matchQuotaPool = (gs, modelLbl, uCore, pickWin) => {
      if (!gs.length) return null;
      if (typeof uCore?.chooseQuotaGroup === 'function') {
        const chosen = uCore.chooseQuotaGroup(gs, modelLbl);
        if (chosen) return chosen;
      }
      const low = String(modelLbl || '').toLowerCase();
      const norm = normModelKey(low);
      if (/argon/.test(low)) {
        const arg = gs.find((g) => /argon|wtu/i.test(`${g?.id || ''} ${g?.name || ''}`));
        if (arg) return arg;
      }
      if (norm.length >= 3) {
        const descHit = gs.find((g) => {
          const desc = String(g?.description || '');
          if (!desc) return false;
          const ci = desc.indexOf(':');
          const entries = (ci >= 0 ? desc.slice(ci + 1) : desc).split(/[,;\n]+/).map(normModelKey).filter((s) => s.length >= 3);
          return entries.some((e) => norm === e || norm.startsWith(e + ' ') || e.startsWith(norm + ' '));
        });
        if (descHit) return descHit;
      }
      if (/claude|anthropic|sonnet|opus|haiku|gpt|openai|\bo[134]\b/.test(low)) {
        const cl = gs.find((g) => /claude|anthropic|gpt|openai|(?:^|\s)3p(?:\s|$|-)/i.test(`${g?.id || ''} ${g?.name || ''} ${g?.description || ''}`));
        if (cl) return cl;
      }
      if (/gemini|neon|carbon|hydrogen|orchestrator|\bpro\b|flash|argon/.test(low)) {
        const gm = gs.find((g) => /gemini|google/i.test(`${g?.id || ''} ${g?.name || ''} ${g?.description || ''}`));
        if (gm) return gm;
      }
      return gs.find((g) => pickWin(g).length > 0) || gs[0];
    };
    const quotaLevel = (pct) => (pct <= 20 ? 'low' : pct <= 25 ? 'tight' : 'ok');
    const schedModelSync = (delay = 35) => {
      if (!fbEl || !lastSnap || mode === 'off') return;
      if (modelSyncTm !== null) clearTimeout(modelSyncTm);
      modelSyncTm = setTimeout(() => {
        modelSyncTm = null;
        if (!fbEl || !lastSnap || mode === 'off') return;
        const nextModel = readLiveModel(gD(), '');
        if (nextModel && nextModel !== lastModelLbl) applySnap(lastSnap);
      }, delay);
      modelSyncTm?.unref?.();
    };

    const gStr = () => FB_I18N[gD()?.documentElement?.getAttribute?.('data-ag-cs-lang') || expLang || 'zh-CN'] || FB_I18N['zh-CN'];
    const syncLbls = () => {
      if (!srEl) return;
      const t = gStr(), ns = srEl.querySelectorAll?.('[data-fb-i18n]') || [];
      for (let i = 0; i < ns.length; i++) {
        const k = ns[i].getAttribute('data-fb-i18n');
        if (k && typeof t[k] === 'string' && ns[i].textContent !== t[k]) ns[i].textContent = t[k];
      }
    };

    const applySnap = (snap) => {
      if (snap && typeof snap === 'object') {
        const keepGroups = !snap.groups?.length && lastSnap?.groups?.length;
        lastSnap = keepGroups ? { ...snap, groups: lastSnap.groups } : snap;
      }
      if (!srEl || !fbEl) return;
      const effSnap = snap && typeof snap === 'object' ? (snap.groups?.length ? snap : { ...snap, groups: lastSnap?.groups || snap.groups || [] }) : lastSnap;
      const sp = effSnap?.speed || {}, ctx = sp.context || {};
      const maxTok = ctx.maxTokens > 0 ? ctx.maxTokens : 512000;
      const uf = isFin(ctx.usedFraction) ? Math.max(0, Math.min(1, ctx.usedFraction)) : 0.04;
      const uTok = isFin(ctx.usedTokens) ? ctx.usedTokens : Math.round(uf * maxTok);
      const pct = Math.round(uf * 100), rem = Math.max(0, 100 - pct);
      const model = ctx.model || sp.model || 'Antigravity Model';
      const tot = sp.taskUsage?.total?.totalTokens ?? sp.tokens?.totalTokens ?? sp.cache?.totalTokens ?? sp.totalTokens ?? 0;
      const hit = isFin(sp.cache?.hitRate) ? sp.cache.hitRate : sp.cacheHitRate;
      const subs = Number(sp.taskUsage?.subagents || 0);
      const proc = snap?.collection?.state === 'processing';

      if (proc) fbEl.setAttribute('data-collection', 'processing');
      else fbEl.removeAttribute('data-collection');

      const t = gStr();
      syncLbls();
      const sT = (id, v) => { const e = srEl.getElementById(id), s = String(v); if (e && e.textContent !== s) e.textContent = s; };
      sT('rounds', sp.rounds > 0 ? `${sp.rounds}r` : '—');
      sT('tps', isFin(sp.tps) && sp.tps > 0 ? sp.tps.toFixed(1) : '—');
      sT('cache-total', `${fmtTok(tot > 0 ? tot : uTok)} tok`);
      sT('cache-rate', isFin(hit) ? `${(hit * 100).toFixed(1)}%` : '—');

      const sb = srEl.getElementById('subagent-badge');
      if (sb) {
        if (subs > 0) {
          sb.hidden = false;
          const bt = t.agents(subs);
          if (sb.textContent !== bt) sb.textContent = bt;
        } else sb.hidden = true;
      }

      sT('context-percent', `${pct}%`);
      const xBtn = srEl.querySelector?.('[data-card="context"]');
      if (xBtn) {
        if (uf >= 0.75) xBtn.setAttribute('data-caution', '1');
        else xBtn.removeAttribute('data-caution');
      }
      sT('ttft', typeof sp.ttftSeconds === 'number' ? `${sp.ttftSeconds.toFixed(2)}s` : '—');
      sT('latest-rate', typeof sp.latestTps === 'number' ? `${sp.latestTps.toFixed(1)} tok/s` : '—');
      const elapSec = isFin(sp.elapsedSeconds) ? sp.elapsedSeconds : isFin(sp.durationSeconds) ? sp.durationSeconds : isFin(sp.lastDurationMs) ? sp.lastDurationMs / 1000 : (isFin(sp.modelSeconds) && sp.modelSeconds > 0 ? sp.modelSeconds : null);
      const fmtDur = (s0) => (s0 >= 60 ? `${(s0 / 60).toFixed(1)}m` : `${s0.toFixed(1)}s`);
      const elapStr = elapSec !== null && sp.rounds > 0 ? `${fmtDur(elapSec)} · ${sp.rounds}r` : elapSec !== null ? fmtDur(elapSec) : sp.rounds > 0 ? `${sp.rounds}r` : '—';
      sT('speed-elapsed', elapStr);
      sT('speed-head-meta', isFin(sp.peakTps) && sp.peakTps > 0 ? t.peakShort(`${Math.round(sp.peakTps)} tok/s`) : (sp.requests > 0 ? `${sp.requests} req` : ''));
      const inTok = sp.tokens?.inputTokens ?? sp.taskUsage?.total?.inputTokens ?? null;
      const outTok = sp.tokens?.outputTokens ?? sp.taskUsage?.total?.outputTokens ?? null;
      const ownTok = sp.taskUsage?.own?.totalTokens ?? null;
      const subTok = sp.taskUsage?.subagentTokens ?? (isFin(ownTok) && tot > ownTok ? tot - ownTok : null);
      let splitStr = '—';
      if (isFin(inTok) && isFin(outTok) && (inTok > 0 || outTok > 0)) splitStr = `${fmtTok(inTok)} in · ${fmtTok(outTok)} out`;
      else if (isFin(subTok) && subTok > 0 && tot > 0) splitStr = `${Math.round(((tot - subTok) / tot) * 100)}% / ${Math.round((subTok / tot) * 100)}%`;
      else if (tot > 0) splitStr = `${fmtTok(tot)} tok`;
      sT('speed-split', splitStr);

      sT('cache-card-rate', isFin(hit) ? `${(hit * 100).toFixed(1)}%` : '—');
      const readTok = sp.cache?.cachedTokens ?? sp.cache?.readTokens ?? sp.tokens?.cachedTokens ?? sp.tokens?.cacheReadTokens ?? sp.counts?.cacheRead ?? sp.taskUsage?.total?.cacheReadTokens ?? null;
      const estSaved = isFin(readTok) ? `${fmtTok(readTok)} tok` : isFin(hit) && hit > 0 && tot > 0 ? `~${fmtTok(Math.round(tot * hit))} tok` : '—';
      sT('cache-card-saved', estSaved);
      sT('cache-head-meta', sp.requests > 0 ? `${sp.requests} req` : '');
      const subShare = isFin(subTok) && subTok > 0 && tot > 0 ? ` (${Math.round((subTok / tot) * 100)}%)` : '';
      sT('cache-card-subs', subs > 0 ? `${subs}${subShare}` : '0');
      sT('cache-card-total', `${fmtTok(tot > 0 ? tot : uTok)} tok`);
      const openSubBtn = srEl.getElementById?.('cache-open-subs');
      if (openSubBtn) openSubBtn.hidden = !(subs > 0);

      const qChipEl = srEl.querySelector?.('[data-card="quota"]');
      const qBarsEl = srEl.getElementById?.('quota-bars');
      const qTrkW = srEl.getElementById?.('quota-trk-w');
      const qTrk5 = srEl.getElementById?.('quota-trk-5');
      const qBarW = srEl.getElementById?.('quota-bar-w');
      const qBar5 = srEl.getElementById?.('quota-bar-5');
      const qWTxt = srEl.getElementById?.('quota-w-txt');
      const qWLbl = srEl.getElementById?.('quota-w-lbl');
      const qWNum = srEl.getElementById?.('quota-w-num');
      const qSep = srEl.getElementById?.('quota-sep');
      const q5Txt = srEl.getElementById?.('quota-5-txt');
      const qCardEl = srEl.getElementById?.('quota-card');
      const qListEl = srEl.getElementById?.('quota-card-list');
      const gs = Array.isArray(effSnap?.groups) ? effSnap.groups : [];
      const uCore = gW()?.__agCsUsageCore;
      const liveModel = readLiveModel(gD(), model);
      lastModelLbl = liveModel;
      const pickWin = (g) => {
        if (!g) return [];
        const raw = typeof uCore?.quotaWindows === 'function' ? uCore.quotaWindows(g) : (() => {
          const ws = g.windows || {};
          const o = [];
          for (const k of ['weekly', '5h']) {
            const b = ws[k];
            const r = b && b.available !== false && b.disabled !== true ? Number(b.remaining ?? b.remainingFraction) : NaN;
            if (b && isFin(r)) o.push([k, b]);
          }
          return o;
        })();
        // Weekly-first ordering
        return raw.slice().sort((a, b) => (a[0] === 'weekly' ? -1 : b[0] === 'weekly' ? 1 : 0));
      };
      const winRem = (bk) => Math.max(0, Math.min(1, Number(bk?.remaining ?? bk?.remainingFraction ?? 0)));
      const grpLabel = (g) => (typeof uCore?.quotaGroupLabel === 'function' ? uCore.quotaGroupLabel(g, t.lang) : (g?.name || g?.id || 'Pool'));
      const actGrp = matchQuotaPool(gs, liveModel, uCore, pickWin);
      const actWins = pickWin(actGrp);
      const wPair = actWins.find(([wk]) => wk === 'weekly') || null;
      const h5Pair = actWins.find(([wk]) => wk === '5h') || null;
      if (qChipEl) {
        if (actWins.length > 0) {
          const wPct = wPair ? Math.round(winRem(wPair[1]) * 100) : null;
          const h5Pct = h5Pair ? Math.round(winRem(h5Pair[1]) * 100) : null;
          const wLvl = wPct !== null ? quotaLevel(wPct) : 'ok';
          const h5Lvl = h5Pct !== null ? quotaLevel(h5Pct) : 'ok';
          const minPct = Math.min(wPct !== null ? wPct : 100, h5Pct !== null ? h5Pct : 100);
          const chipLvl = quotaLevel(minPct);
          const pLbl = grpLabel(actGrp);
          const tipParts = [];
          if (wPair) {
            const etaW = fmtResetEta(wPair[1], t.lang, uCore);
            tipParts.push(`${t.weekShort} ${wPct}%${etaW ? ` (${t.resetFmt(etaW)})` : ''}`);
          }
          if (h5Pair) {
            const eta5 = fmtResetEta(h5Pair[1], t.lang, uCore);
            tipParts.push(`5h ${h5Pct}%${eta5 ? ` (${t.resetFmt(eta5)})` : ''}`);
          }
          const tip = `${pLbl} · ${tipParts.join(' · ')}`;
          qChipEl.hidden = false;
          qChipEl.setAttribute('data-level', chipLvl);
          qChipEl.setAttribute('data-pool', actGrp?.id || '');
          qChipEl.setAttribute('title', tip);
          qChipEl.setAttribute('aria-label', tip);
          const singleWin = !(wPair && h5Pair);
          if (qBarsEl) {
            if (singleWin) qBarsEl.setAttribute('data-single', '1');
            else qBarsEl.removeAttribute('data-single');
          }
          if (qTrkW) qTrkW.hidden = !wPair;
          if (qTrk5) qTrk5.hidden = !h5Pair;
          if (qBarW && wPair) {
            qBarW.setAttribute('data-level', wLvl);
            if (qBarW.style) qBarW.style.width = wPct <= 0 ? '0%' : `${Math.max(4, wPct)}%`;
          }
          if (qBar5 && h5Pair) {
            qBar5.setAttribute('data-level', h5Lvl);
            if (qBar5.style) qBar5.style.width = h5Pct <= 0 ? '0%' : `${Math.max(4, h5Pct)}%`;
          }
          if (qWTxt) {
            const priPair = wPair || h5Pair;
            const priPct = wPair ? wPct : h5Pct;
            const priLvl = wPair ? wLvl : h5Lvl;
            const priLbl = wPair ? (t.lang === 'en' ? `${t.weekShort} ` : t.weekShort) : '5h ';
            qWTxt.hidden = !priPair;
            qWTxt.setAttribute('data-level', priLvl);
            if (qWLbl && qWLbl.textContent !== priLbl) qWLbl.textContent = priLbl;
            if (qWNum && qWNum.textContent !== `${priPct}%`) qWNum.textContent = `${priPct}%`;
          }
          const showDual = Boolean(wPair && h5Pair);
          if (qSep) qSep.hidden = !showDual;
          if (q5Txt) {
            q5Txt.hidden = !showDual;
            if (showDual) {
              q5Txt.setAttribute('data-level', h5Lvl);
              const s5 = `5h ${h5Pct}%`;
              if (q5Txt.textContent !== s5) q5Txt.textContent = s5;
            }
          }
          syncQCompact();
        } else {
          qChipEl.hidden = true;
          qChipEl.setAttribute('aria-expanded', 'false');
          if (qCardEl) qCardEl.hidden = true;
        }
      }
      sT('quota-head-model', liveModel);
      if (qListEl && gs.length > 0) {
        const doc = gD();
        if (doc && typeof doc.createElement === 'function') {
          qListEl.textContent = '';
          const ordered = actGrp ? [actGrp, ...gs.filter((g) => g !== actGrp)] : gs.slice();
          for (const g of ordered) {
            const ws = pickWin(g);
            if (!ws.length) continue;
            const isAct = g === actGrp;
            const priPct = Math.round(winRem(ws[0][1]) * 100);
            let minG = 100;
            for (const [, bk] of ws) minG = Math.min(minG, Math.round(winRem(bk) * 100));
            const gLvl = quotaLevel(minG);
            const nameKids = [mk(doc, 'span', { cls: 'q-name', text: grpLabel(g) })];
            if (isAct) nameKids.push(mk(doc, 'span', { cls: 'q-tag', text: t.curPool }));
            const winEls = [];
            for (const [wk, bk] of ws) {
              const wPct = Math.round(winRem(bk) * 100);
              const wLvl = quotaLevel(wPct);
              const wTitle = wk === 'weekly' ? t.weekLbl : t.fiveLbl;
              const eta = fmtResetEta(bk, t.lang, uCore);
              const barFill = mk(doc, 'i', { 'data-level': wLvl });
              if (barFill.style) barFill.style.width = wPct <= 0 ? '0%' : `${Math.max(3, wPct)}%`;
              winEls.push(
                mk(doc, 'div', { cls: 'q-win', 'data-window': wk }, [
                  mk(doc, 'div', { cls: 'q-win-meta' }, [
                    mk(doc, 'span', { text: `${wTitle} · ${wPct}%` }),
                    mk(doc, 'span', { text: eta ? t.resetFmt(eta) : '' }),
                  ]),
                  mk(doc, 'div', { cls: isAct ? 'q-bar' : 'q-bar q-bar-sm' }, [barFill]),
                ])
              );
            }
            const rowBtn = mk(doc, 'button', {
              type: 'button',
              cls: isAct ? 'q-row q-active' : 'q-row',
              'data-pool': g.id || '',
              'data-level': gLvl,
              ...(isAct ? { 'data-active': '1' } : {}),
            }, [
              mk(doc, 'div', { cls: 'q-top' }, [
                mk(doc, 'span', { cls: 'q-name-wrap' }, nameKids),
                mk(doc, 'span', { cls: 'q-val', 'data-level': gLvl, text: `${priPct}%` }),
              ]),
              mk(doc, 'div', { cls: 'q-wins' }, winEls),
            ]);
            rowBtn.addEventListener('click', (e) => {
              e?.stopPropagation?.();
              const trig = gD()?.querySelector?.('[data-testid="model-selector-trigger"]');
              if (trig?.click) {
                trig.click();
                if (qCardEl) qCardEl.hidden = true;
                qChipEl?.setAttribute?.('aria-expanded', 'false');
                try {
                  const w0 = gW();
                  w0?.__agPulseExternalBridge?.({ event: 'card' });
                  const CE = w0?.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
                  if (CE) {
                    w0?.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail: { open: false, cards: [] } }));
                    gD()?.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail: { open: false, cards: [] } }));
                  }
                } catch {}
              }
            });
            qListEl.appendChild(rowBtn);
          }
        }
      }

      const curRounds = isFin(sp.rounds) ? sp.rounds : 0;
      const turnDone = (lastProc && !proc) || (lastRounds > 0 && curRounds > lastRounds);
      lastProc = proc;
      if (curRounds > 0) lastRounds = curRounds;
      if (turnDone && !isBlur() && snap?.connection !== 'local-estimate' && Date.now() - lastQuotaSyncAt >= 15000) {
        lastQuotaSyncAt = Date.now();
        void reqSnap({ conversationId: detCid(fbEl), force: false, quotaRefresh: true }).then((ns) => { if (ns) applySnap(ns); });
      }

      sT('context-summary', t.usedTxt(pct));
      sT('context-rem', t.remPart(rem));
      sT('context-tokens', `${fmtTok(uTok)} / ${fmtTok(maxTok)}`);
      const remTok = Math.max(0, maxTok - uTok);
      const vialFootStr = t.vialRem(fmtTok(remTok));
      const xCardEl = srEl.getElementById?.('context-card');
      xCardEl?.style?.setProperty?.('--vial-foot', JSON.stringify(vialFootStr));
      const vFt = srEl.querySelector?.('#context-card .pv-ft');
      if (vFt) vFt.setAttribute('data-vial-foot', vialFootStr);
      // Compute exact 3-layer breakdown matching pulse-vial-bridge computeLayerRatios
      const sSys = uf > 0 ? Math.min(uf * 0.34, Math.max(0.02, Math.min(0.12, 14000 / maxTok))) : 0;
      const sRem = Math.max(0, uf - sSys);
      const mSec = Number(sp.modelSeconds || 0), tSec = Number(sp.toolSeconds || 0);
      const sTool = sRem * (mSec + tSec > 0.05 ? Math.max(0.16, Math.min(0.42, tSec / (mSec + tSec))) : 0.24);
      const sMsg = Math.max(0, sRem - sTool);
      const tok0 = Math.round(sSys * maxTok), tok2 = Math.round(sTool * maxTok), tok1 = Math.max(0, uTok - tok0 - tok2);
      sT('ctx-s0', uTok > 0 ? fmtTok(tok0) : '—');
      sT('ctx-s1', uTok > 0 ? fmtTok(tok1) : '—');
      sT('ctx-s2', uTok > 0 ? fmtTok(tok2) : '—');

      sT('ctx-ttft', typeof sp.ttftSeconds === 'number' ? `${sp.ttftSeconds.toFixed(2)}s` : '—');
      const liveRate = isFin(sp.latestTps) && sp.latestTps > 0 ? sp.latestTps : (isFin(sp.tps) && sp.tps > 0 ? sp.tps : null);
      sT('ctx-tps', liveRate !== null ? `${liveRate.toFixed(1)} tok/s` : '—');
      sT('ctx-cache', isFin(hit) ? `${(hit * 100).toFixed(1)}%` : '—');
      const savedCompact = isFin(readTok) && readTok > 0 ? t.savedShort(fmtTok(readTok)) : (isFin(hit) && hit > 0 && uTok > 0 ? t.savedShort(fmtTok(Math.round(uTok * hit))) : '');
      sT('ctx-cache-sub', savedCompact);
      const compactLimit = Math.round(maxTok * 0.8);
      const toComp = Math.max(0, compactLimit - uTok);
      const cmpValEl = srEl.getElementById?.('ctx-compact');
      const cmpCardEl = srEl.getElementById?.('ctx-compact-card');
      sT('ctx-compact', toComp > 0 ? t.leftShort(fmtTok(toComp)) : t.atLimit);
      if (cmpValEl) {
        if (uf >= 0.8) cmpValEl.setAttribute('data-level', 'low');
        else if (uf >= 0.65) cmpValEl.setAttribute('data-level', 'tight');
        else cmpValEl.removeAttribute('data-level');
      }
      if (cmpCardEl) {
        if (uf >= 0.65) cmpCardEl.setAttribute('data-clickable', '1');
        else cmpCardEl.removeAttribute('data-clickable');
      }
      sT('context-model', liveModel || model);
      const noteEl = srEl.getElementById('context-note');
      if (noteEl) {
        noteEl.hidden = true;
        if (noteEl.textContent) noteEl.textContent = '';
      }

      const fl = srEl.getElementById('context-fill');
      if (fl?.style) fl.style.width = `${pct}%`;
      const rg = srEl.getElementById('context-ring');
      rg?.style?.setProperty?.('--used-angle', `${Math.round(uf * 360)}deg`);
      try { gW()?.__agPulseExternalBridge?.({ event: 'render', data: snap }); } catch {}
    };

    const isHidAnc = (el) => !el || el.hidden === true || Boolean(el.closest?.('.agy-home, aside, [data-testid="conversation-list-sidebar"], [data-testid="conversation-row-sidebar"], [hidden], [inert]'));
    const isTopWrap = (p) => {
      if (!p) return true;
      const c = String(p.className || '').trim();
      return Boolean(c && /\bmin-w-0\b/.test(c) && !/\b(?:flex|inline-flex|agy-composer-footer)\b/.test(c));
    };
    const findAnchor = (doc, knownConv = false) => {
      if (!doc) return null;
      const w = gW();
      if (!knownConv && !isConv(doc, w)) return null;
      const ft = doc.querySelector?.('.agy-composer-footer, [data-testid="input-box-bottom-toolbar"]');
      if (ft && !isHidAnc(ft) && (knownConv || isConv(doc, w, ft))) return ft;
      const mb = doc.querySelector?.('[data-testid="model-selector-trigger"]');
      return mb?.parentElement && !isHidAnc(mb) && !isTopWrap(mb.parentElement) && (knownConv || isConv(doc, w, mb)) ? mb.parentElement : null;
    };

    const seatIn = (anc, el) => {
      if (!anc || !el) return false;
      const kids = anc.children || [];
      if (/\bagy-composer-footer\b/.test(String(anc.className || '')) && kids.length >= 2 && typeof anc.insertBefore === 'function') {
        const last = kids[kids.length - 1];
        if (last && last !== el) { anc.insertBefore(el, last); return true; }
      }
      anc.appendChild(el);
      return true;
    };

    const seatFb = (doc) => {
      if (!fbEl || !doc) return false;
      const anc = findAnchor(doc);
      if (!anc) { unmountFb(true); return false; }
      if (!isConn(doc, fbEl) || fbEl.parentElement !== anc) {
        try { seatIn(anc, fbEl); } catch { return false; }
      }
      return true;
    };

    let lastHealAt = 0;
    const IGN_STREAM_SEL =
      '[data-testid="autoscroll-viewport"],[data-testid="planner-response-text"],[data-testid="agent-response"],[data-markdown-root],[data-testid="background-task-command"],[data-testid="running-items-card"],aside,[data-op-thought="1"],.ag-prism-thought-overlay,.ag-cs-conv-aura-host,.ag-cs-crab,.ag-cs-prism-rim-cv,.ag-anim-icon,.ag-cs-thinking-spark,[data-agy-hans-ui],#agy-theme-switcher,#agy-theme-menu,#antigravity-quota-widget,#antigravity-translation-audit';
    const isIgnoredStreamNode = (t) => {
      const el = t?.nodeType === 1 ? t : t?.parentElement;
      return Boolean(
        el?.closest &&
        !el.closest('.agy-composer-footer,[data-testid="input-box-bottom-toolbar"]') &&
        el.closest(IGN_STREAM_SEL)
      );
    };

    const ensSeatObs = () => {
      const w = gW(), doc = gD();
      if (!w || !doc || mode === 'off') return;
      const runHeal = () => {
        healTm = null;
        lastHealAt = Date.now();
        if (mode === 'off') return;
        const d = gD(), wn = gW();
        if (!d || !wn) return;
        if (!isConv(d, wn)) {
          yielded = false;
          if (fbEl) unmountFb(true);
          hideExt(false);
          return;
        }
        if (mode === 'on') {
          hideExt(true);
          if (fbEl) {
            if (!isConn(d, fbEl) && seatFb(d)) try { wn.__agPulseExternalBridge?.({ event: 'mount' }); } catch {}
            ensTierObs();
          } else if (findAnchor(d, true)) {
            mountFb();
          }
          return;
        }
        showExt();
        if (hasExt(null, true)) {
          yielded = true;
          if (fbEl) unmountFb(true);
          ensTierObs();
          return;
        }
        if (fbEl) {
          if (!isConn(d, fbEl) && seatFb(d)) try { wn.__agPulseExternalBridge?.({ event: 'mount' }); } catch {}
          ensTierObs();
        } else if (waitTm === null && findAnchor(d, true)) {
          mountFb();
        }
      };
      const schedHeal = (fast = false) => {
        if (mode === 'off' || healTm !== null) return;
        const wait = fast || Date.now() - lastHealAt >= 180 ? 45 : 180;
        healTm = setTimeout(runHeal, wait);
        healTm?.unref?.();
      };
      if (!seatObs && typeof w.MutationObserver === 'function' && (doc.body || doc.documentElement)) {
        seatObs = new w.MutationObserver((recs) => {
          if (mode === 'off' || healTm !== null) return;
          if (Array.isArray(recs) && recs.length > 0) {
            let rel = false;
            let hitFooter = false;
            for (let i = 0; i < recs.length; i++) {
              const tg = recs[i]?.target;
              if (!isIgnoredStreamNode(tg)) {
                rel = true;
                const te = tg?.nodeType === 1 ? tg : tg?.parentElement;
                if (!hitFooter && te?.closest?.('[data-testid="model-selector-trigger"],.agy-composer-footer,[data-testid="input-box-bottom-toolbar"]')) hitFooter = true;
              }
            }
            if (!rel) return;
            if (hitFooter && fbEl && lastSnap?.groups?.length > 0) schedModelSync(30);
          }
          const inC = isConv(doc, w);
          let bars = null;
          const gB = () => bars || (bars = findExtBars(doc));
          if (!inC) {
            if (fbEl || gB().some((b) => b && b.getAttribute?.(HID_ATTR) !== '1')) schedHeal(true);
            return;
          }
          if (fbEl) {
            if (!isConn(doc, fbEl)) {
              schedHeal(false);
              return;
            }
          } else if (waitTm === null && !hasExt(gB(), true) && findAnchor(doc, true)) {
            schedHeal(true);
            return;
          }
          if ((tierEl && !tierEl.isConnected) || gB().some((b) => b && b.getAttribute?.(HID_ATTR) !== '1' && b.shadowRoot && !b.shadowRoot.querySelector?.(`style[${TIER_STYLE_ATTR}="1"]`))) {
            schedHeal(false);
            return;
          }
          if (mode === 'on' && gB().some((b) => b && b.getAttribute?.(FALLBACK_ATTR) !== '1' && b.getAttribute?.(HID_ATTR) !== '1')) {
            schedHeal(false);
          }
        });
        try { seatObs.observe(doc.body || doc.documentElement, { childList: true, subtree: true }); } catch {}
      }
      if (!popOff && typeof w.addEventListener === 'function') {
        const onPop = () => schedHeal(true);
        w.addEventListener('popstate', onPop);
        popOff = () => w.removeEventListener?.('popstate', onPop);
      }
    };

    async function refresh(quotaForce = false) {
      const w = gW(), doc = gD();
      if (!envOpts && w?.__agPrismTelemetry && w.__agPrismTelemetry !== api) { unmountFb(); return null; }
      if (!isConv(doc, w)) {
        yielded = false;
        unmountFb(true);
        if (mode !== 'off') hideExt();
        return null;
      }
      if (mode === 'on') hideExt(true);
      else {
        showExt();
        if (hasExt(null, true)) { yielded = true; unmountFb(true); ensTierObs(); return null; }
      }
      if (mode !== 'off' && fbEl) {
        purgeOrphans(doc, fbEl);
        if (!seatFb(doc)) return null;
      }
      if (!fbEl || !isConn(doc, fbEl)) {
        if (mode !== 'off' && (mode === 'on' || !hasExt(null, true)) && waitTm === null && findAnchor(doc, true)) mountFb();
        if (!fbEl || !isConn(doc, fbEl)) return null;
      }
      ensTierObs();
      const doQuota = Boolean(quotaForce && Date.now() - lastQuotaSyncAt >= 15000);
      if (doQuota) lastQuotaSyncAt = Date.now();
      const snap = await reqSnap({ conversationId: detCid(fbEl), force: false, ...(doQuota ? { quotaRefresh: true } : {}) });
      applySnap(snap);
      return snap;
    }

    function mountFb() {
      const w = gW(), doc = gD();
      if (!w || !doc || (typeof doc.attachShadow === 'undefined' && typeof doc.createElement !== 'function')) return false;
      if (!envOpts && w.__agPrismTelemetry && w.__agPrismTelemetry !== api) { unmountFb(); return false; }
      if (mode === 'off') return false;
      if (!isConv(doc, w)) {
        yielded = false;
        unmountFb(true);
        hideExt();
        ensSeatObs();
        return false;
      }
      if (mode === 'on') hideExt(true);
      else if (hasExt(null, true)) { yielded = true; unmountFb(true); ensSeatObs(); return false; }
      if (fbEl && seatFb(doc)) { purgeOrphans(doc, fbEl); ensSeatObs(); return true; }

      const anc = findAnchor(doc, true);
      if (!anc) { ensSeatObs(); return false; }
      const E = (t, a, k) => mk(doc, t, a, k);
      const host = E('div', {
        id: PRISM_BAR_ID,
        [FALLBACK_ATTR]: '1',
        [PRISM_BAR_ATTR]: 'true',
        'data-ag-owned': '1',
        translate: 'no',
        'data-no-translate': 'true',
        'data-ag-localization-skip': 'true',
        'data-agy-no-translate': 'true',
        'data-antigravity-zh-skip': '1',
      });
      if (typeof host.attachShadow !== 'function') return false;
      const sr = host.attachShadow({ mode: 'open' });
      sr.appendChild(E('style', { text: SHADOW_CSS }));

      const t0 = gStr();
      const sChip = E('button', { type: 'button', cls: 'chip', 'data-card': 'speed', 'aria-expanded': 'false' }, [
        E('span', { cls: 'rounds dim', id: 'rounds', text: '—' }),
        E('strong', { id: 'tps', text: '—' }),
        E('span', { cls: 'dim', text: 'tok/s' }),
      ]);
      const cChip = E('button', { type: 'button', cls: 'chip', 'data-card': 'cache', 'aria-expanded': 'false' }, [
        E('span', { cls: 'cache-total', id: 'cache-total', text: '—' }),
        E('span', { cls: 'sub-badge', id: 'subagent-badge', hidden: true, text: '' }),
        E('span', { cls: 'dim', text: '·' }),
        E('span', { 'data-i18n': 'cache', 'data-fb-i18n': 'cache', text: t0.cache }),
        E('strong', { id: 'cache-rate', text: '—' }),
      ]);
      const xChip = E('button', { type: 'button', cls: 'chip', 'data-card': 'context', 'aria-expanded': 'false' }, [
        E('span', { cls: 'context-ring', id: 'context-ring' }),
        E('span', { cls: 'context-label dim', 'data-i18n': 'contextShort', text: 'Ctx' }),
        E('strong', { id: 'context-percent', text: '0%' }),
      ]);
      const qChip = E('button', { type: 'button', cls: 'chip quota-chip', 'data-card': 'quota', 'aria-expanded': 'false', hidden: true }, [
        E('span', { cls: 'quota-bars', id: 'quota-bars', 'aria-hidden': 'true' }, [
          E('span', { cls: 'q-trk q-trk-w', id: 'quota-trk-w' }, [E('i', { id: 'quota-bar-w' })]),
          E('span', { cls: 'q-trk q-trk-5', id: 'quota-trk-5' }, [E('i', { id: 'quota-bar-5' })]),
        ]),
        E('span', { cls: 'quota-txt', id: 'quota-badge-txt' }, [
          E('strong', { cls: 'q-w-txt', id: 'quota-w-txt' }, [
            E('span', { cls: 'q-w-lbl', id: 'quota-w-lbl', text: '' }),
            E('span', { cls: 'q-w-num', id: 'quota-w-num', text: '' }),
          ]),
          E('span', { cls: 'q-sep', id: 'quota-sep', text: '·', hidden: true }),
          E('span', { cls: 'q-5-txt', id: 'quota-5-txt', text: '', hidden: true }),
        ]),
      ]);
      const sCard = E('section', { cls: 'card', id: 'speed-card', hidden: true }, [
        E('div', { cls: 'heading' }, [
          E('span', { 'data-fb-i18n': 'speedHeading', text: t0.speedHeading }),
          E('span', { cls: 'q-head-model', id: 'speed-head-meta', text: '' }),
        ]),
        E('div', { cls: 'ctx-metrics' }, [
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'ttft', text: t0.ttft }), E('span', { cls: 'ctx-mtag', text: 'TTFT' })]),
            E('strong', { cls: 'ctx-mval', id: 'ttft', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'latestRate', text: t0.latestRate }), E('span', { cls: 'ctx-mtag', text: 'TPS' })]),
            E('strong', { cls: 'ctx-mval', id: 'latest-rate', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'elapsed', text: t0.elapsed })]),
            E('strong', { cls: 'ctx-mval', id: 'speed-elapsed', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'tokSplit', text: t0.tokSplit })]),
            E('strong', { cls: 'ctx-mval', id: 'speed-split', text: '—' }),
          ]),
        ]),
      ]);
      const openSubBtnEl = E('button', { type: 'button', cls: 'act-btn', id: 'cache-open-subs', 'data-fb-i18n': 'openSubs', hidden: true, text: t0.openSubs });
      const cCard = E('section', { cls: 'card', id: 'cache-card', hidden: true }, [
        E('div', { cls: 'heading' }, [
          E('span', { 'data-fb-i18n': 'cacheHeading', text: t0.cacheHeading }),
          E('span', { cls: 'q-head-model', id: 'cache-head-meta', text: '' }),
        ]),
        E('div', { cls: 'ctx-metrics' }, [
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'hitRate', text: t0.hitRate })]),
            E('strong', { cls: 'ctx-mval', id: 'cache-card-rate', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'savedTok', text: t0.savedTok })]),
            E('strong', { cls: 'ctx-mval', id: 'cache-card-saved', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'activeSubs', text: t0.activeSubs })]),
            E('strong', { cls: 'ctx-mval', id: 'cache-card-subs', text: '0' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [E('span', { 'data-fb-i18n': 'totalTok', text: t0.totalTok })]),
            E('strong', { cls: 'ctx-mval', id: 'cache-card-total', text: '—' }),
          ]),
        ]),
        openSubBtnEl,
      ]);
      const qSwitchBtnEl = E('button', { type: 'button', cls: 'act-btn', id: 'quota-switch-btn', 'data-fb-i18n': 'switchModel', text: t0.switchModel });
      const qCard = E('section', { cls: 'card', id: 'quota-card', hidden: true }, [
        E('div', { cls: 'heading' }, [
          E('span', { 'data-fb-i18n': 'quotaHeading', text: t0.quotaHeading }),
          E('span', { cls: 'q-head-model', id: 'quota-head-model', text: '' }),
        ]),
        E('div', { cls: 'q-list', id: 'quota-card-list' }),
        qSwitchBtnEl,
      ]);
      const cmpCardEl = E('div', { cls: 'ctx-mcard', id: 'ctx-compact-card' }, [
        E('span', { cls: 'ctx-mlbl' }, [
          E('span', { 'data-fb-i18n': 'toCompact', text: t0.toCompact }),
          E('span', { cls: 'ctx-mtag', text: '80%' }),
        ]),
        E('strong', { cls: 'ctx-mval', id: 'ctx-compact', text: '—' }),
      ]);
      const xCard = E('section', { cls: 'card context-card', id: 'context-card', hidden: true }, [
        E('div', { cls: 'heading' }, [E('span', { 'data-fb-i18n': 'ctxHeading', text: t0.ctxHeading })]),
        E('div', { cls: 'ctx-hero' }, [
          E('span', { cls: 'ctx-hero-l' }, [
            E('strong', { id: 'context-summary', text: t0.usedTxt(0) }),
            E('span', { cls: 'ctx-rem', id: 'context-rem', text: t0.remPart(100) }),
          ]),
          E('p', { id: 'context-tokens', text: '— / 512K' }),
        ]),
        E('div', { cls: 'track', id: 'context-track' }, [E('i', { id: 'context-fill' })]),
        E('div', { cls: 'ctx-legend', id: 'ctx-legend' }, [
          E('span', { cls: 'ctx-leg' }, [E('i', { cls: 'ctx-dot ctx-d0' }), E('span', { 'data-fb-i18n': 'sliceSys', text: t0.sliceSys }), E('b', { id: 'ctx-s0', text: '—' })]),
          E('span', { cls: 'ctx-leg' }, [E('i', { cls: 'ctx-dot ctx-d1' }), E('span', { 'data-fb-i18n': 'sliceMsg', text: t0.sliceMsg }), E('b', { id: 'ctx-s1', text: '—' })]),
          E('span', { cls: 'ctx-leg' }, [E('i', { cls: 'ctx-dot ctx-d2' }), E('span', { 'data-fb-i18n': 'sliceTool', text: t0.sliceTool }), E('b', { id: 'ctx-s2', text: '—' })]),
        ]),
        E('div', { cls: 'ctx-metrics' }, [
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [
              E('span', { 'data-fb-i18n': 'ttft', text: t0.ttft }),
              E('span', { cls: 'ctx-mtag', text: 'TTFT' }),
            ]),
            E('strong', { cls: 'ctx-mval', id: 'ctx-ttft', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [
              E('span', { 'data-fb-i18n': 'genRate', text: t0.genRate }),
              E('span', { cls: 'ctx-mtag', text: 'TPS' }),
            ]),
            E('strong', { cls: 'ctx-mval', id: 'ctx-tps', text: '—' }),
          ]),
          E('div', { cls: 'ctx-mcard' }, [
            E('span', { cls: 'ctx-mlbl' }, [
              E('span', { 'data-fb-i18n': 'cacheHit', text: t0.cacheHit }),
              E('span', { cls: 'ctx-mtag', text: 'CACHE' }),
            ]),
            E('span', { cls: 'ctx-mval-row' }, [
              E('strong', { cls: 'ctx-mval', id: 'ctx-cache', text: '—' }),
              E('span', { cls: 'ctx-msub', id: 'ctx-cache-sub', text: '' }),
            ]),
          ]),
          cmpCardEl,
        ]),
        E('dl', { cls: 'ctx-model-dl' }, [
          E('dt', { 'data-fb-i18n': 'curModel', text: t0.curModel }),
          E('dd', { id: 'context-model', text: '—' }),
        ]),
        E('p', { cls: 'footnote', id: 'context-note', hidden: true, text: '' }),
      ]);

      sr.appendChild(E('div', { cls: 'bar' }, [sChip, cChip, xChip, qChip]));
      sr.appendChild(sCard);
      sr.appendChild(cCard);
      sr.appendChild(xCard);
      sr.appendChild(qCard);

      const allPairs = [[sCard, sChip], [cCard, cChip], [xCard, xChip], [qCard, qChip]];
      let pinnedCard = null;
      const notifyCard = () => {
        const openCards = [];
        for (const [cd] of allPairs) if (!cd.hidden) openCards.push(cd.id);
        try { w.__agPulseExternalBridge?.({ event: 'card' }); } catch {}
        try {
          const CE = w.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
          if (CE) {
            const detail = { open: openCards.length > 0, cards: openCards };
            w.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail }));
            doc.dispatchEvent?.(new CE('ag-prism-pulse-card-change', { detail }));
          }
        } catch {}
      };
      const closeAll = () => {
        clrHover();
        pinnedCard = null;
        let had = false;
        for (const [cd, bt] of allPairs) {
          if (!cd.hidden) had = true;
          cd.hidden = true;
          bt.setAttribute('aria-expanded', 'false');
        }
        return had;
      };
      const openCard = (card, btn, pin) => {
        const wasOpen = !card.hidden;
        for (const [cd, bt] of allPairs) {
          if (cd !== card) {
            cd.hidden = true;
            bt.setAttribute('aria-expanded', 'false');
          }
        }
        card.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        pinnedCard = pin ? card : null;
        if (!wasOpen) {
          void refresh(card === qCard);
          notifyCard();
        }
      };
      const tog = (card, btn) => {
        clrHover();
        if (card.hidden) {
          openCard(card, btn, true);
        } else if (pinnedCard === card) {
          closeAll();
          notifyCard();
        } else {
          pinnedCard = card;
        }
      };
      const schedHoverOpen = (card, btn) => {
        if (hoverCloseTm !== null) { clearTimeout(hoverCloseTm); hoverCloseTm = null; }
        if (!card.hidden) return;
        if (hoverOpenTm !== null) { clearTimeout(hoverOpenTm); hoverOpenTm = null; }
        const anyOpen = allPairs.some(([cd]) => !cd.hidden);
        const delay = anyOpen ? 30 : 300;
        hoverOpenTm = setTimeout(() => {
          hoverOpenTm = null;
          if (!fbEl || mode === 'off') return;
          openCard(card, btn, false);
        }, delay);
        hoverOpenTm?.unref?.();
      };
      const schedHoverClose = (card) => {
        if (hoverOpenTm !== null) { clearTimeout(hoverOpenTm); hoverOpenTm = null; }
        if (pinnedCard === card || card.hidden) return;
        if (hoverCloseTm !== null) { clearTimeout(hoverCloseTm); hoverCloseTm = null; }
        hoverCloseTm = setTimeout(() => {
          hoverCloseTm = null;
          if (pinnedCard === card || card.hidden) return;
          if (closeAll()) notifyCard();
        }, 220);
        hoverCloseTm?.unref?.();
      };
      for (const [cd, bt] of allPairs) {
        bt.addEventListener?.('mouseenter', () => schedHoverOpen(cd, bt));
        bt.addEventListener?.('mouseleave', () => schedHoverClose(cd));
        cd.addEventListener?.('mouseenter', () => {
          if (hoverCloseTm !== null) { clearTimeout(hoverCloseTm); hoverCloseTm = null; }
        });
        cd.addEventListener?.('mouseleave', () => schedHoverClose(cd));
      }
      cmpCardEl.addEventListener?.('click', (e) => {
        if (cmpCardEl.getAttribute?.('data-clickable') !== '1') return;
        e?.stopPropagation?.();
        try { sr.querySelector?.('.pv-cmp')?.click?.(); } catch {}
      });
      xChip.addEventListener('click', (e) => { e?.stopPropagation?.(); tog(xCard, xChip); });
      sChip.addEventListener('click', (e) => { e?.stopPropagation?.(); tog(sCard, sChip); });
      cChip.addEventListener('click', (e) => { e?.stopPropagation?.(); tog(cCard, cChip); });
      qChip.addEventListener('click', (e) => { e?.stopPropagation?.(); tog(qCard, qChip); });
      openSubBtnEl.addEventListener?.('click', (e) => {
        e?.stopPropagation?.();
        const ov = doc.querySelector?.('[data-testid="overview-panel"]');
        const btn = ov ? ov.querySelector?.('[data-testid="subagent-node"], [data-testid="running-row"], button') : doc.querySelector?.('[data-testid="toggle-aux-sidebar"]');
        try { (btn || ov)?.click?.(); (btn || ov)?.scrollIntoView?.({ block: 'nearest' }); } catch {}
        if (closeAll()) notifyCard();
      });
      qSwitchBtnEl.addEventListener?.('click', (e) => {
        e?.stopPropagation?.();
        try { doc.querySelector?.('[data-testid="model-selector-trigger"]')?.click?.(); } catch {}
        if (closeAll()) notifyCard();
      });

      if (typeof doc.addEventListener === 'function') {
        const onDoc = (ev) => {
          if (lastSnap?.groups?.length > 0) schedModelSync(80);
          if (ev?.target === host || host.contains?.(ev?.target)) return;
          if (closeAll()) notifyCard();
        };
        const onKey = (ev) => {
          if (ev?.key === 'Escape' && closeAll()) notifyCard();
        };
        doc.addEventListener('click', onDoc);
        doc.addEventListener('keydown', onKey);
        docOff = () => doc.removeEventListener('click', onDoc);
        keyOff = () => doc.removeEventListener('keydown', onKey);
      }

      purgeOrphans(doc, null);
      seatIn(anc, host);
      fbEl = host;
      srEl = sr;
      yielded = false;

      ensSeatObs();
      ensHost();
      ensTierObs();
      try { w.__agPulseExternalBridge?.({ event: 'mount' }); } catch {}
      ensBlur();
      void refresh();
      startPoll();
      return true;
    }

    const getState = () => {
      const mounted = Boolean(fbEl && isConn(gD(), fbEl));
      const blurred = isBlur();
      if (mounted && blurred && pollTm !== null) { pollSusp = true; clrPoll(); }
      return {
        mode,
        mountedFallback: mounted,
        waitingForExternal: waitTm !== null,
        yieldedToExternal: Boolean(mode === 'auto' && (yielded || hasExt())),
        hasExternal: hasExt(),
        pollSuspended: Boolean(mounted && (pollSusp || blurred)),
      };
    };

    function sync(cfg) {
      if (cfg && typeof cfg.language === 'string' && cfg.language) expLang = cfg.language;
      const raw = cfg && cfg.telemetryModule;
      mode = raw === 'on' || raw === 'off' ? raw : 'auto';
      if (srEl && mode !== 'off') {
        syncLbls();
        if (lastSnap) applySnap(lastSnap);
      }
      if (mode === 'off') {
        yielded = false;
        unmountFb();
        hideExt();
        return getState();
      }
      ensBridge();
      ensSeatObs();
      const doc = gD(), w = gW();
      if (!isConv(doc, w)) {
        yielded = false;
        unmountFb(true);
        hideExt();
        ensHost();
        return getState();
      }
      if (mode === 'on') {
        yielded = false;
        clrWait();
        hideExt(true);
        ensHost();
        mountFb();
        return getState();
      }
      showExt();
      if (hasExt()) {
        yielded = true;
        unmountFb(true);
        ensHost();
        ensTierObs();
        if (detAt > 0 && rescTm === null) {
          rescTm = setTimeout(() => {
            rescTm = null;
            if (mode !== 'off' && !hasExt()) mountFb();
          }, GRACE_MS + 60);
          rescTm?.unref?.();
        }
        return getState();
      }
      if (fbEl && seatFb(doc)) return getState();
      if (findExtBars(doc).some((b) => b && b.getAttribute?.(FALLBACK_ATTR) !== '1' && isConn(doc, b) && !usableExt(doc, b))) {
        clrWait();
        mountFb();
        return getState();
      }
      if (waitTm === null) {
        const ms = isFin(cfg?.__fallbackDelayMs) && cfg.__fallbackDelayMs >= 0 ? cfg.__fallbackDelayMs : WAIT_MS;
        waitTm = setTimeout(() => {
          waitTimerDone();
        }, ms);
        waitTm?.unref?.();
      }
      return getState();
    }

    function waitTimerDone() {
      waitTm = null;
      if (mode !== 'auto') return;
      if (!isConv(gD(), gW())) { unmountFb(true); hideExt(); return; }
      if (hasExt()) { yielded = true; unmountFb(true); ensHost(); ensTierObs(); return; }
      mountFb();
    }

    function destroy() {
      clrWait();
      clrSeat();
      unmountFb();
      showExt();
      const w = gW();
      if (w) {
        if (mApi && w.__agPrismMetricsBridge === mApi) delete w.__agPrismMetricsBridge;
        if (mRes && w.__agPrismMetricsResolve === mRes) delete w.__agPrismMetricsResolve;
      }
      yielded = false;
      lastSig = '';
      detAt = 0;
    }

    const api = {
      BAR_ID,
      PRISM_BAR_ID,
      PRISM_BAR_ATTR,
      FALLBACK_ATTR,
      METRICS_BINDING,
      sync,
      destroy,
      refresh,
      getLatestSnapshot: () => lastSnap,
      getState,
      createTelemetryController,
    };
    return api;
  }

  return createTelemetryController();
});
