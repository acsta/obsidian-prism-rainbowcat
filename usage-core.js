(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__agCsUsageCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const HOME_HEAT_WEEKS = 26;
  const HOME_HEAT_RAMP = [8, 28, 52, 76, 100];
  const HOME_HEAT_STEPS = HOME_HEAT_RAMP.length;
  const HOME_CHART_DAYS = 30;
  const HOME_MODEL_ROWS = 6;
  const HOME_MODEL_COLOUR_COUNT = 10;

  function numOr(v) {
    return typeof v === 'bigint' ? Number(v) : v;
  }

  function toNum(v) {
    const n = typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string' ? Number(v) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function resolveLang(langOrZh) {
    if (langOrZh === true) return 'zh-CN';
    if (langOrZh === false || langOrZh === null) return 'en';
    if (langOrZh === 'zh-TW' || langOrZh === 'yue' || langOrZh === 'en' || langOrZh === 'ja') return langOrZh;
    return 'zh-CN';
  }

  function pickByLang(map, langOrZh, fallback = '') {
    const l = resolveLang(langOrZh);
    if (!map) return fallback;
    if (map[l] !== undefined) return map[l];
    if (l === 'yue' && map['zh-TW'] !== undefined) return map['zh-TW'];
    return map['zh-CN'] !== undefined ? map['zh-CN'] : (map.en !== undefined ? map.en : fallback);
  }

  const HOME_RANGES = [
    { id: 'all', days: 0, labelZh: '全部', labelEn: 'All', labels: { 'zh-CN': '全部', 'zh-TW': '全部', yue: '全部', en: 'All', ja: '全期間' } },
    { id: '30d', days: 30, labelZh: '30 天', labelEn: '30d', labels: { 'zh-CN': '30 天', 'zh-TW': '30 天', yue: '30 日', en: '30d', ja: '30日間' } },
    { id: '7d', days: 7, labelZh: '7 天', labelEn: '7d', labels: { 'zh-CN': '7 天', 'zh-TW': '7 天', yue: '7 日', en: '7d', ja: '7日間' } },
  ];

  // Book yardsticks matched by token count (measured via o200k_base in dsh-claude-style).
  const HOME_BOOKS = [
    { key: 'tao', tokens: 7607, zh: '《道德经》', zhTW: '《道德經》', ja: '『老子（道徳経）』', en: 'Tao Te Ching' },
    { key: 'yellow', tokens: 7778, zh: '《黄色壁纸》', zhTW: '《黃色壁紙》', ja: '『黄色い壁紙』', en: 'The Yellow Wallpaper' },
    { key: 'meta', tokens: 27557, zh: '《变形记》', zhTW: '《變形記》', ja: '『変身』', en: 'Metamorphosis' },
    { key: 'jekyll', tokens: 34713, zh: '《化身博士》', zhTW: '《化身博士》', ja: '『ジーキル博士とハイド氏』', en: 'The Strange Case of Dr Jekyll and Mr Hyde' },
    { key: 'alice', tokens: 37248, zh: '《爱丽丝漫游奇境》', zhTW: '《愛麗絲夢遊仙境》', ja: '『不思議の国のアリス』', en: "Alice's Adventures in Wonderland" },
    { key: 'animal', tokens: 39000, zh: '《动物农场》', zhTW: '《動物農莊》', ja: '『動物農場』', en: 'Animal Farm' },
    { key: 'carol', tokens: 40306, zh: '《圣诞颂歌》', zhTW: '《小氣財神》', yue: '《聖誕頌歌》', ja: '『クリスマス・キャロル』', en: 'A Christmas Carol' },
    { key: 'wild', tokens: 42383, zh: '《野性的呼唤》', zhTW: '《野性的呼喚》', ja: '『野生の呼び声』', en: 'The Call of the Wild' },
    { key: 'time', tokens: 42817, zh: '《时间机器》', zhTW: '《時間機器》', ja: '『タイム・マシン』', en: 'The Time Machine' },
    { key: 'oz', tokens: 51004, zh: '《绿野仙踪》', zhTW: '《綠野仙蹤》', ja: '『オズの魔法使い』', en: 'The Wonderful Wizard of Oz' },
    { key: 'darkness', tokens: 52163, zh: '《黑暗之心》', zhTW: '《黑暗之心》', ja: '『闇の奥』', en: 'Heart of Darkness' },
    { key: 'faust', tokens: 53930, zh: '《浮士德》', zhTW: '《浮士德》', ja: '『ファウスト』', en: 'Faust' },
    { key: 'screw', tokens: 57484, zh: '《螺丝在拧紧》', zhTW: '《碧廬冤孽》', ja: '『ねじの回転』', en: 'The Turn of the Screw' },
    { key: 'aesop', tokens: 60707, zh: '《伊索寓言》', zhTW: '《伊索寓言》', ja: '『イソップ寓話』', en: "Aesop's Fables" },
    { key: 'peter', tokens: 63821, zh: '《彼得·潘》', zhTW: '《小飛俠彼得潘》', ja: '『ピーター・パン』', en: 'Peter Pan' },
    { key: 'gatsby', tokens: 65763, zh: '《了不起的盖茨比》', zhTW: '《大亨小傳》', ja: '『グレート・ギャツビー』', en: 'The Great Gatsby' },
    { key: 'prince', tokens: 66670, zh: '《君主论》', zhTW: '《君王論》', ja: '『君主論』', en: 'The Prince' },
    { key: 'invisible', tokens: 68163, zh: '《隐形人》', zhTW: '《隱形人》', ja: '『透明人間』', en: 'The Invisible Man' },
    { key: 'andersen', tokens: 73931, zh: '《安徒生童话》', zhTW: '《安徒生童話》', ja: '『アンデルセン童話集』', en: "Andersen's Fairy Tales" },
    { key: 'worlds', tokens: 80168, zh: '《世界大战》', zhTW: '《世界大戰》', ja: '『宇宙戦争』', en: 'The War of the Worlds' },
    { key: 'beyond', tokens: 89836, zh: '《善恶的彼岸》', zhTW: '《善惡的彼岸》', ja: '『善悪の彼岸』', en: 'Beyond Good and Evil' },
    { key: 'whitefang', tokens: 96418, zh: '《白牙》', zhTW: '《白牙》', ja: '『白い牙』', en: 'White Fang' },
    { key: 'meditations', tokens: 96973, zh: '《沉思录》', zhTW: '《沉思錄》', ja: '『自省録』', en: 'Meditations' },
    { key: 'frankenstein', tokens: 97886, zh: '《弗兰肯斯坦》', zhTW: '《科學怪人》', ja: '『フランケンシュタイン』', en: 'Frankenstein' },
    { key: 'stone', tokens: 100000, zh: '《哈利·波特与魔法石》', zhTW: '《哈利波特：神秘的魔法石》', ja: '『ハリー・ポッターと賢者の石』', en: "Harry Potter and the Philosopher's Stone" },
    { key: 'dorian', tokens: 106339, zh: '《道林·格雷的画像》', zhTW: '《格雷的畫像》', ja: '『ドリアン・グレイの肖像』', en: 'The Picture of Dorian Gray' },
    { key: 'tolive', tokens: 115000, zh: '《活着》', zhTW: '《活著》', ja: '『生きる』', en: 'To Live' },
    { key: 'hobbit', tokens: 123000, zh: '《霍比特人》', zhTW: '《哈比人歷險記》', yue: '《哈比人》', ja: '『ホビットの冒険』', en: 'The Hobbit' },
    { key: 'grimm', tokens: 132467, zh: '《格林童话》', zhTW: '《格林童話》', ja: '『グリム童話集』', en: "Grimms' Fairy Tales" },
    { key: '1984', tokens: 136278, zh: '《一九八四》', zhTW: '《一九八四》', ja: '『1984年』', en: 'Nineteen Eighty-Four' },
    { key: 'sherlock', tokens: 138725, zh: '《福尔摩斯冒险史》', zhTW: '《福爾摩斯冒險史》', ja: '『シャーロック・ホームズの冒険』', en: 'The Adventures of Sherlock Holmes' },
    { key: 'gulliver', tokens: 138958, zh: '《格列佛游记》', zhTW: '《格列佛遊記》', ja: '『ガリヴァー旅行記』', en: "Gulliver's Travels" },
    { key: 'walden', tokens: 152659, zh: '《瓦尔登湖》', zhTW: '《湖濱散記》', ja: '『ウォールデン 森の生活』', en: 'Walden' },
    { key: 'crusoe', tokens: 153596, zh: '《鲁滨逊漂流记》', zhTW: '《魯賓遜漂流記》', ja: '『ロビンソン・クルーソー』', en: 'Robinson Crusoe' },
    { key: 'huck', tokens: 154263, zh: '《哈克贝利·费恩历险记》', zhTW: '《頑童歷險記》', ja: '『ハックルベリー・フィンの冒険』', en: 'Adventures of Huckleberry Finn' },
    { key: 'divine', tokens: 157765, zh: '《神曲》', zhTW: '《神曲》', ja: '『神曲』', en: 'The Divine Comedy' },
    { key: 'bovary', tokens: 159575, zh: '《包法利夫人》', zhTW: '《包法利夫人》', ja: '『ボヴァリー夫人』', en: 'Madame Bovary' },
    { key: 'zarathustra', tokens: 161488, zh: '《查拉图斯特拉如是说》', zhTW: '《查拉圖斯特拉如是說》', ja: '『ツァラトゥストラはこう語った』', en: 'Thus Spoke Zarathustra' },
    { key: 'pride', tokens: 171701, zh: '《傲慢与偏见》', zhTW: '《傲慢與偏見》', ja: '『高慢と偏見』', en: 'Pride and Prejudice' },
    { key: 'odyssey', tokens: 173150, zh: '《奥德赛》', zhTW: '《奧德賽》', ja: '『オデュッセイア』', en: 'The Odyssey' },
    { key: 'twocities', tokens: 187333, zh: '《双城记》', zhTW: '《雙城記》', ja: '『二都物語』', en: 'A Tale of Two Cities' },
    { key: 'threebody', tokens: 202000, zh: '《三体》', zhTW: '《三體》', ja: '『三体』', en: 'The Three-Body Problem' },
    { key: 'dracula', tokens: 213648, zh: '《德古拉》', zhTW: '《德古拉》', ja: '『ドラキュラ』', en: 'Dracula' },
    { key: 'expectations', tokens: 252176, zh: '《远大前程》', zhTW: '《孤星血淚》', ja: '『大いなる遺産』', en: 'Great Expectations' },
    { key: 'janeeyre', tokens: 256179, zh: '《简·爱》', zhTW: '《簡·愛》', ja: '『ジェイン・エア』', en: 'Jane Eyre' },
    { key: 'republic', tokens: 279539, zh: '《理想国》', zhTW: '《理想國》', ja: '『国家』', en: 'The Republic' },
    { key: 'crime', tokens: 285009, zh: '《罪与罚》', zhTW: '《罪與罰》', ja: '『罪と罰』', en: 'Crime and Punishment' },
    { key: 'leviathan', tokens: 304696, zh: '《利维坦》', zhTW: '《利維坦》', ja: '『リヴァイアサン』', en: 'Leviathan' },
    { key: 'moby', tokens: 306522, zh: '《白鲸》', zhTW: '《白鯨記》', ja: '『白鯨』', en: 'Moby-Dick' },
    { key: 'darkforest', tokens: 307000, zh: '《三体Ⅱ·黑暗森林》', zhTW: '《三體Ⅱ·黑暗森林》', ja: '『三体II 黒暗森林』', en: 'The Dark Forest' },
    { key: 'deathsend', tokens: 336000, zh: '《三体Ⅲ·死神永生》', zhTW: '《三體Ⅲ·死神永生》', ja: '『三体III 死神永生』', en: "Death's End" },
    { key: 'anna', tokens: 481659, zh: '《安娜·卡列尼娜》', zhTW: '《安娜·卡列尼娜》', ja: '『アンナ・カレーニナ』', en: 'Anna Karenina' },
    { key: 'karamazov', tokens: 487590, zh: '《卡拉马佐夫兄弟》', zhTW: '《卡拉馬佐夫兄弟》', ja: '『カラマーゾフの兄弟』', en: 'The Brothers Karamazov' },
    { key: 'quixote', tokens: 574243, zh: '《堂吉诃德》', zhTW: '《唐吉訶德》', ja: '『ドン・キホーテ』', en: 'Don Quixote' },
    { key: 'lotr', tokens: 625000, zh: '《魔戒》', zhTW: '《魔戒》', ja: '『指輪物語』', en: 'The Lord of the Rings' },
    { key: 'kingdoms', tokens: 638009, zh: '《三国演义》', zhTW: '《三國演義》', ja: '『三国志演義』', en: 'Romance of the Three Kingdoms' },
    { key: 'montecristo', tokens: 651128, zh: '《基督山伯爵》', zhTW: '《基督山恩仇記》', ja: '『モンテ・クリスト伯』', en: 'The Count of Monte Cristo' },
    { key: 'warpeace', tokens: 769001, zh: '《战争与和平》', zhTW: '《戰爭與和平》', ja: '『戦争と平和』', en: 'War and Peace' },
    { key: 'journeywest', tokens: 783200, zh: '《西游记》', zhTW: '《西遊記》', ja: '『西遊記』', en: 'Journey to the West' },
    { key: 'miserables', tokens: 801791, zh: '《悲惨世界》', zhTW: '《悲慘世界》', yue: '《孤星淚》', ja: '『レ・ミゼラブル』', en: 'Les Misérables' },
    { key: 'redchamber', tokens: 903956, zh: '《红楼梦》', zhTW: '《紅樓夢》', ja: '『紅楼夢』', en: 'Dream of the Red Chamber' },
    { key: 'watermargin', tokens: 958242, zh: '《水浒传》', zhTW: '《水滸傳》', ja: '『水滸伝』', en: 'Water Margin' },
    { key: 'ordinary', tokens: 998000, zh: '《平凡的世界》', zhTW: '《平凡的世界》', ja: '『平凡な世界』', en: 'Ordinary World' },
    { key: 'harrypotter', tokens: 1409000, zh: '《哈利·波特》全集', zhTW: '《哈利波特》全集', ja: '『ハリー・ポッター』全巻', en: 'the whole Harry Potter series' },
    { key: 'losttime', tokens: 1647000, zh: '《追忆似水年华》', zhTW: '《追憶似水年華》', ja: '『失われた時を求めて』', en: 'In Search of Lost Time' },
  ];

  function homeBookTitle(book, langOrZh) {
    if (!book) return '';
    const l = resolveLang(langOrZh);
    if (l === 'en') return book.en;
    if (l === 'ja') return book.ja || book.en;
    if (l === 'yue') return book.yue || book.zhTW || book.zh;
    if (l === 'zh-TW') return book.zhTW || book.zh;
    return book.zh;
  }

  function homeRangeLabel(rangeOrId, langOrZh) {
    const r = typeof rangeOrId === 'string' ? (HOME_RANGES.find((x) => x.id === rangeOrId) || HOME_RANGES[0]) : rangeOrId;
    if (!r) return '';
    return pickByLang(r.labels, langOrZh, r.labelZh);
  }

  function pad2(v) {
    return v < 10 ? '0' + v : String(v);
  }

  function homeDayKey(date) {
    const d = date instanceof Date ? date : new Date(numOr(date));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function homeRangeStart(windowDays, nowDate) {
    if (!windowDays) return null;
    const start = nowDate ? new Date(nowDate.getTime()) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (windowDays - 1));
    return homeDayKey(start);
  }

  function formatHomeCount(count) {
    const value = Math.round(toNum(count));
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatCompactTokens(count) {
    const value = toNum(count);
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    for (let u = 0; u < units.length; u++) {
      const scaled = Math.round((value / units[u][0]) * 10) / 10;
      if (scaled >= 1) return String(scaled) + units[u][1];
    }
    return String(Math.round(value));
  }

  function formatHomeHour(hour, langOrZh) {
    const h = ((Math.floor(toNum(hour)) % 24) + 24) % 24;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const l = resolveLang(langOrZh);
    if (l === 'zh-CN') return (h < 12 ? '上午 ' : '下午 ') + h12 + ' 点';
    if (l === 'zh-TW') return (h < 12 ? '上午 ' : '下午 ') + h12 + ' 點';
    if (l === 'yue') return (h < 12 ? '上晝 ' : '下晝 ') + h12 + ' 點';
    if (l === 'ja') return (h < 12 ? '午前 ' : '午後 ') + h12 + ' 時';
    return h12 + (h < 12 ? ' AM' : ' PM');
  }

  function homeShortDateFormat(langOrZh) {
    const map = { 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', yue: 'zh-HK', en: 'en-US', ja: 'ja-JP' };
    return new Intl.DateTimeFormat(map[resolveLang(langOrZh)] || 'en-US', { month: 'short', day: 'numeric' });
  }

  function homeShortDate(format, day) {
    const parts = String(day || '').split('-');
    if (parts.length !== 3) return String(day || '');
    return format.format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  function tsToMs(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return Number.isFinite(ts) ? ts : 0;
    if (typeof ts === 'string' || typeof ts === 'bigint') {
      const parsed = typeof ts === 'string' ? Date.parse(ts) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
      const num = toNum(ts);
      return num > 0 ? (num > 1e11 ? num : num * 1000) : 0;
    }
    const sec = toNum(ts.seconds);
    return sec > 0 ? sec * 1000 + Math.floor(toNum(ts.nanos) / 1e6) : 0;
  }

  function cleanModelName(val) {
    const direct = val?.modelDisplayName || val?.responseModel || val?.modelName;
    if (direct && String(direct).trim()) return String(direct).trim();
    const m = val?.model;
    if (typeof m === 'string' && m.trim()) {
      return /^\d+$/.test(m.trim()) ? 'Model #' + m.trim() : m.trim();
    }
    if (m) return 'Model #' + m;
    return 'unknown';
  }

  function isSubagentSummary(summary) {
    if (!summary || typeof summary !== 'object') return false;
    if (summary.subagent === true) return true;
    const meta = summary.trajectoryMetadata || {};
    return Boolean(meta.parentConversationId || summary.parentConversationId) || toNum(meta.nestingDepth) > 0;
  }

  function normalizeWorkspaceLabel(rawUriOrPath) {
    const s = String(rawUriOrPath || '').trim();
    if (!s) return '';
    try {
      const decoded = decodeURIComponent(s.replace(/^file:\/\//i, '')).replace(/[\\/]+$/, '');
      const segs = decoded.split(/[\\/]/).filter(Boolean);
      return segs.length ? segs[segs.length - 1] : '';
    } catch {
      const segs = s.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean);
      return segs.length ? segs[segs.length - 1] : '';
    }
  }

  function extractWorkspaceId(summaryObj, trajObj) {
    if (summaryObj && typeof summaryObj.workspace === 'string' && summaryObj.workspace.trim()) {
      return normalizeWorkspaceLabel(summaryObj.workspace);
    }
    const wsList =
      summaryObj?.workspaces ||
      summaryObj?.trajectoryMetadata?.workspaces ||
      trajObj?.metadata?.workspaces ||
      [];
    const first = Array.isArray(wsList) && wsList.length ? wsList[0] : null;
    const candidate =
      first?.workspaceFolderAbsoluteUri ||
      first?.gitRootAbsoluteUri ||
      first?.uri ||
      first?.path ||
      summaryObj?.workspaceUri ||
      summaryObj?.workspacePath ||
      summaryObj?.trajectoryMetadata?.workspaceUri ||
      '';
    return normalizeWorkspaceLabel(candidate);
  }

  function extractParentConversationId(summaryObj, trajObj) {
    const pid =
      summaryObj?.trajectoryMetadata?.parentConversationId ||
      summaryObj?.parentConversationId ||
      summaryObj?.rootConversationId ||
      trajObj?.metadata?.parentConversationId ||
      '';
    return String(pid || '').trim();
  }

  // Extract a compact, JSON-serializable per-conversation usage record for caching.
  function analyzeTrajectoryForUsage(trajObj, summaryObj, cascadeId) {
    const t = trajObj?.response?.trajectory || trajObj?.trajectory || trajObj || {};
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const gmList = Array.isArray(t.generatorMetadata) ? t.generatorMetadata : [];
    const stepTime = new Map();
    for (let i = 0; i < steps.length; i++) {
      const ms = tsToMs(steps[i]?.metadata?.createdAt || steps[i]?.createdAt);
      if (ms > 0) stepTime.set(i, ms);
    }
    const createdMs = tsToMs(summaryObj?.createdTime) || tsToMs(t?.metadata?.createdAt) || 0;
    const lastModMs = tsToMs(summaryObj?.lastModifiedTime) || 0;
    const fallbackMs = lastModMs || createdMs || 0;
    const totalStepSpan = Math.max(1, toNum(summaryObj?.stepCount ?? trajObj?.numTotalSteps ?? steps.length ?? 1));

    const days = {}; // YYYY-MM-DD -> { calls, input, output, cacheRead, cacheWrite, total, hours: number[24], models: { [id]: { input, output, cacheRead, cacheWrite, total, calls } } }
    let calls = 0;

    for (let i = 0; i < gmList.length; i++) {
      const val = gmList[i]?.metadata?.value || gmList[i]?.chatModel;
      if (!val) continue;
      const u = val.usage || val.retryInfos?.[val.retryInfos.length - 1]?.usage || gmList[i]?.usage;
      if (!u) continue;
      const input = toNum(u.inputTokens);
      const cacheRead = toNum(u.cacheReadTokens);
      const cacheWrite = toNum(u.cacheWriteTokens);
      const output = toNum(u.outputTokens);
      const total = input + cacheRead + cacheWrite + output;
      if (total <= 0 && input === 0 && output === 0) continue;

      calls += 1;
      const sIndices = Array.isArray(gmList[i].stepIndices) ? gmList[i].stepIndices : [];
      let ts = 0;
      for (let k = 0; k < sIndices.length; k++) {
        const hit = stepTime.get(numOr(sIndices[k]));
        if (hit) {
          ts = hit;
          break;
        }
      }
      if (!ts) {
        const chatCreatedMs = tsToMs(val?.chatStartMetadata?.createdAt);
        if (chatCreatedMs > 0) {
          ts = chatCreatedMs;
        } else if (steps.length === 0 && createdMs > 0 && lastModMs > createdMs && sIndices.length > 0) {
          const ratio = Math.min(1, Math.max(0, toNum(sIndices[0]) / totalStepSpan));
          ts = Math.round(createdMs + ratio * (lastModMs - createdMs));
        } else {
          ts = fallbackMs;
        }
      }
      if (!ts) continue;

      const d = new Date(ts);
      const dayKey = homeDayKey(d);
      const hour = d.getHours();
      const modelId = cleanModelName(val);

      let day = days[dayKey];
      if (!day) {
        day = {
          calls: 0,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          hours: new Array(24).fill(0),
          models: {},
        };
        days[dayKey] = day;
      }
      day.calls += 1;
      day.input += input;
      day.output += output;
      day.cacheRead += cacheRead;
      day.cacheWrite += cacheWrite;
      day.total += total;
      day.hours[hour] = (day.hours[hour] || 0) + 1;

      let mod = day.models[modelId];
      if (!mod) {
        mod = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, calls: 0 };
        day.models[modelId] = mod;
      }
      mod.input += input;
      mod.output += output;
      mod.cacheRead += cacheRead;
      mod.cacheWrite += cacheWrite;
      mod.total += total;
      mod.calls += 1;
    }

    const lastModifiedSec =
      toNum(summaryObj?.lastModifiedSec) ||
      toNum(summaryObj?.lastModifiedTime?.seconds) ||
      (lastModMs > 0 ? Math.floor(lastModMs / 1000) : 0);
    const workspace = extractWorkspaceId(summaryObj, t);
    const parentId = extractParentConversationId(summaryObj, t);

    return {
      cascadeId: String(cascadeId || t.cascadeId || ''),
      stepCount: Math.max(toNum(summaryObj?.stepCount), toNum(trajObj?.numTotalSteps), steps.length),
      lastModifiedSec,
      gmCount: toNum(trajObj?.numTotalGeneratorMetadata ?? gmList.length),
      subagent: isSubagentSummary(summaryObj),
      workspace,
      parentId,
      calls,
      days,
    };
  }

  function mergeUsageRecordDelta(baseRec, deltaRec, nextMeta = {}) {
    if (!baseRec || !baseRec.days) return deltaRec;
    const days = {};
    for (const [dk, d] of Object.entries(baseRec.days)) {
      if (!d) continue;
      const models = {};
      for (const [mk, mv] of Object.entries(d.models || {})) {
        if (mv) models[mk] = { input: toNum(mv.input), output: toNum(mv.output), cacheRead: toNum(mv.cacheRead), cacheWrite: toNum(mv.cacheWrite), total: toNum(mv.total), calls: toNum(mv.calls) };
      }
      const hours = new Array(24).fill(0);
      if (Array.isArray(d.hours)) for (let h = 0; h < 24; h++) hours[h] = toNum(d.hours[h]);
      days[dk] = {
        calls: toNum(d.calls),
        input: toNum(d.input),
        output: toNum(d.output),
        cacheRead: toNum(d.cacheRead),
        cacheWrite: toNum(d.cacheWrite),
        total: toNum(d.total),
        hours,
        models,
      };
    }
    if (deltaRec && deltaRec.days) {
      for (const [dk, dd] of Object.entries(deltaRec.days)) {
        if (!dd) continue;
        let dst = days[dk];
        if (!dst) {
          dst = {
            calls: 0,
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
            hours: new Array(24).fill(0),
            models: {},
          };
          days[dk] = dst;
        }
        dst.calls += toNum(dd.calls);
        dst.input += toNum(dd.input);
        dst.output += toNum(dd.output);
        dst.cacheRead += toNum(dd.cacheRead);
        dst.cacheWrite += toNum(dd.cacheWrite);
        dst.total += toNum(dd.total);
        if (Array.isArray(dd.hours)) {
          for (let h = 0; h < 24; h++) dst.hours[h] = (dst.hours[h] || 0) + toNum(dd.hours[h]);
        }
        for (const [mk, mv] of Object.entries(dd.models || {})) {
          if (!mv) continue;
          let dm = dst.models[mk];
          if (!dm) {
            dm = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, calls: 0 };
            dst.models[mk] = dm;
          }
          dm.input += toNum(mv.input);
          dm.output += toNum(mv.output);
          dm.cacheRead += toNum(mv.cacheRead);
          dm.cacheWrite += toNum(mv.cacheWrite);
          dm.total += toNum(mv.total);
          dm.calls += toNum(mv.calls);
        }
      }
    }
    return {
      cascadeId: String(nextMeta.cascadeId ?? deltaRec?.cascadeId ?? baseRec.cascadeId ?? ''),
      stepCount: toNum(nextMeta.stepCount ?? deltaRec?.stepCount ?? baseRec.stepCount ?? 0),
      lastModifiedSec: toNum(nextMeta.lastModifiedSec ?? deltaRec?.lastModifiedSec ?? baseRec.lastModifiedSec ?? 0),
      gmCount: toNum(nextMeta.gmCount ?? deltaRec?.gmCount ?? baseRec.gmCount ?? 0),
      subagent: Boolean(nextMeta.subagent ?? deltaRec?.subagent ?? baseRec.subagent),
      workspace: String(nextMeta.workspace ?? deltaRec?.workspace ?? baseRec.workspace ?? ''),
      parentId: String(nextMeta.parentId ?? deltaRec?.parentId ?? baseRec.parentId ?? ''),
      calls: toNum(baseRec.calls) + toNum(deltaRec?.calls),
      days,
    };
  }

  function homeHeatGrid(dayTotalsMap, nowDate) {
    const today = nowDate ? new Date(nowDate.getTime()) : new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (HOME_HEAT_WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay());
    const cells = [];
    let peak = 0;
    for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const key = homeDayKey(cursor);
      const tokens = toNum(dayTotalsMap[key]);
      if (tokens > peak) peak = tokens;
      cells.push({ date: key, tokens, level: 0 });
    }
    for (let c = 0; c < cells.length; c++) {
      if (cells[c].tokens <= 0 || peak <= 0) continue;
      cells[c].level = Math.max(1, Math.min(HOME_HEAT_STEPS, Math.ceil((cells[c].tokens / peak) * HOME_HEAT_STEPS)));
    }
    return { cells, peak };
  }

  function aggregateUsageRollup(records, rangeId, bookPick, zh, nowDate, options = {}) {
    const list = Array.isArray(records) ? records : [];
    const rangeObj = HOME_RANGES.find((r) => r.id === rangeId) || HOME_RANGES[0];
    const start = homeRangeStart(rangeObj.days, nowDate);
    const inRange = (dateStr) => start === null || dateStr >= start;
    const workspaceFilter =
      options && typeof options.workspace === 'string' && options.workspace && options.workspace !== 'all'
        ? options.workspace
        : '';

    const byId = new Map();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r && r.cascadeId) byId.set(r.cascadeId, r);
    }
    const resolveRecWorkspace = (rec) => {
      if (!rec) return '';
      if (rec.workspace) return String(rec.workspace);
      let cur = rec;
      for (let hop = 0; hop < 4 && cur && cur.parentId; hop++) {
        const p = byId.get(cur.parentId);
        if (!p) break;
        if (p.workspace) return String(p.workspace);
        cur = p;
      }
      return '';
    };

    let totalTokens = 0;
    let mainTokens = 0;
    let subagentTokens = 0;
    let totalCalls = 0;
    let totalInput = 0;
    let totalCacheRead = 0;
    const sessionSet = new Set();
    const subagentSessionSet = new Set();
    const activeDaySet = new Set();
    const hourCounts = new Array(24).fill(0);
    const modelTotals = {}; // modelId -> { id, input, output, cacheRead, cacheWrite, tokens, subagentTokens, calls, sessionsSet: Set }
    const allDayTotals = {}; // full calendar day -> tokens (heat grid shows 26 weeks)
    const allDayModels = {}; // full calendar day -> { modelId: tokens } (chart shows 30d/7d)
    const workspaceMap = {}; // wsId -> { id, tokens, sessionsSet: Set }

    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (!rec || !rec.days) continue;
      const wsId = resolveRecWorkspace(rec);
      const dayKeys = Object.keys(rec.days);

      // Accumulate workspace index across all records in range regardless of active workspaceFilter
      if (wsId) {
        let wsEntry = workspaceMap[wsId];
        if (!wsEntry) {
          wsEntry = { id: wsId, tokens: 0, sessionsSet: new Set() };
          workspaceMap[wsId] = wsEntry;
        }
        for (let d = 0; d < dayKeys.length; d++) {
          const dk = dayKeys[d];
          if (!inRange(dk)) continue;
          const day = rec.days[dk];
          if (!day) continue;
          const dt = toNum(day.total);
          wsEntry.tokens += dt;
          if (!rec.subagent && (dt > 0 || toNum(day.calls) > 0)) {
            wsEntry.sessionsSet.add(rec.cascadeId || String(i));
          }
        }
      }

      if (workspaceFilter && wsId !== workspaceFilter) continue;

      let countedSessionInRange = false;
      for (let d = 0; d < dayKeys.length; d++) {
        const dk = dayKeys[d];
        const day = rec.days[dk];
        if (!day) continue;
        const dTotal = toNum(day.total);
        allDayTotals[dk] = (allDayTotals[dk] || 0) + dTotal;

        if (day.models) {
          if (!allDayModels[dk]) allDayModels[dk] = {};
          for (const [mId, mData] of Object.entries(day.models)) {
            allDayModels[dk][mId] = (allDayModels[dk][mId] || 0) + toNum(mData.total);
          }
        }

        if (!inRange(dk)) continue;
        const dCalls = toNum(day.calls);
        if (dTotal > 0 || dCalls > 0) {
          activeDaySet.add(dk);
          if (rec.subagent) {
            subagentSessionSet.add(rec.cascadeId || String(i));
          } else if (!countedSessionInRange) {
            sessionSet.add(rec.cascadeId || String(i));
            countedSessionInRange = true;
          }
        }
        totalTokens += dTotal;
        if (rec.subagent) subagentTokens += dTotal;
        else mainTokens += dTotal;
        totalCalls += dCalls;
        const dCacheRead = toNum(day.cacheRead);
        const dInp = toNum(day.input) + dCacheRead + toNum(day.cacheWrite);
        totalInput += dInp;
        totalCacheRead += dCacheRead;

        if (Array.isArray(day.hours)) {
          for (let h = 0; h < 24; h++) {
            hourCounts[h] += toNum(day.hours[h]);
          }
        }
        if (day.models) {
          for (const [mId, mData] of Object.entries(day.models)) {
            let entry = modelTotals[mId];
            if (!entry) {
              entry = {
                id: mId,
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                tokens: 0,
                subagentTokens: 0,
                calls: 0,
                sessionsSet: new Set(),
              };
              modelTotals[mId] = entry;
            }
            const mTok = toNum(mData.total);
            entry.input += toNum(mData.input);
            entry.output += toNum(mData.output);
            entry.cacheRead += toNum(mData.cacheRead);
            entry.cacheWrite += toNum(mData.cacheWrite);
            entry.tokens += mTok;
            if (rec.subagent) entry.subagentTokens += mTok;
            entry.calls += toNum(mData.calls);
            if (!rec.subagent) entry.sessionsSet.add(rec.cascadeId || String(i));
          }
        }
      }
    }

    let bestHour = 0;
    let hourSum = 0;
    for (let h = 0; h < 24; h++) {
      hourSum += hourCounts[h];
      if (hourCounts[h] > hourCounts[bestHour]) bestHour = h;
    }
    const peakHour = hourSum > 0 ? formatHomeHour(bestHour, zh) : null;

    const models = Object.values(modelTotals)
      .map((m) => {
        const mInp = m.input + m.cacheRead + m.cacheWrite;
        return {
          id: m.id,
          input: m.input,
          output: m.output,
          cacheRead: m.cacheRead,
          cacheWrite: m.cacheWrite,
          tokens: m.tokens,
          subagentTokens: m.subagentTokens,
          cacheHitRate: mInp > 0 ? m.cacheRead / mInp : null,
          calls: m.calls,
          sessions: m.sessionsSet.size,
        };
      })
      .sort((a, b) => b.tokens - a.tokens || b.calls - a.calls || a.id.localeCompare(b.id));

    const workspaces = Object.values(workspaceMap)
      .map((w) => ({ id: w.id, tokens: w.tokens, sessions: w.sessionsSet.size }))
      .filter((w) => w.tokens > 0 || w.sessions > 0)
      .sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id));

    const favModel = models.length > 0 ? models[0].id : null;

    // Book comparison
    let funBook = null;
    if (totalTokens > 0) {
      const pick = typeof bookPick === 'number' && Number.isFinite(bookPick) ? Math.max(0, Math.min(0.999999, bookPick)) : 0.07;
      let idx = Math.min(HOME_BOOKS.length - 1, Math.floor(pick * HOME_BOOKS.length));
      while (idx >= 0 && totalTokens < HOME_BOOKS[idx].tokens) idx -= 1;
      if (idx >= 0) {
        const book = HOME_BOOKS[idx];
        const count = Math.max(1, Math.round(totalTokens / book.tokens));
        const l = resolveLang(zh);
        const title = homeBookTitle(book, l);
        const cntStr = formatHomeCount(count);
        if (l === 'zh-CN') funBook = `你的 Token 用量相当于 ${cntStr} 本${title}。`;
        else if (l === 'zh-TW') funBook = `您的 Token 用量相當於 ${cntStr} 本${title}。`;
        else if (l === 'yue') funBook = `你用咗嘅 Token 相當於 ${cntStr} 本${title}。`;
        else if (l === 'ja') funBook = `消費トークン数は${title} ${cntStr} 冊分に相当します。`;
        else funBook = `You've used ~${cntStr}× the tokens in ${title}.`;
      }
    }

    // Chart columns (last 30d or 7d)
    const chartSpan = rangeObj.days > 0 && rangeObj.days < HOME_CHART_DAYS ? rangeObj.days : HOME_CHART_DAYS;
    const chartStart = homeRangeStart(chartSpan, nowDate);
    const modelDays = Object.keys(allDayModels)
      .filter((dk) => dk >= chartStart)
      .sort()
      .map((dk) => ({ date: dk, models: allDayModels[dk] }));

    return {
      sessions: sessionSet.size,
      subagentSessions: subagentSessionSet.size,
      calls: totalCalls,
      tokens: totalTokens,
      mainTokens,
      subagentTokens,
      totalInput,
      cacheReadTokens: totalCacheRead,
      cacheHitRate: totalInput > 0 ? totalCacheRead / totalInput : null,
      activeDays: activeDaySet.size,
      peakHour,
      model: favModel,
      grid: homeHeatGrid(allDayTotals, nowDate),
      funBook,
      models,
      modelDays,
      workspaces,
    };
  }

  // ── v0.9.1 Quota Pools, Argon Weekly Allowance & Linear Depletion Forecast ──
  function quotaGroupKind(group) {
    if (!group || typeof group !== 'object') return 'other';
    const w5 = group.windows?.['5h']?.id || group.fiveHour?.id || '';
    const ww = group.windows?.weekly?.id || group.weekly?.id || '';
    const idName = `${group.id || ''} ${group.name || ''} ${w5} ${ww}`.toLowerCase();
    if (/argon|wtu/.test(idName)) return 'gemini-argon';
    if (/claude|anthropic|gpt|openai|(?:^|\s)3p(?:\s|$|-)/.test(idName)) return 'claude';
    if (/gemini|google/.test(idName)) return 'gemini';
    const desc = String(group.description || '').toLowerCase();
    if (/claude|anthropic|gpt|openai/.test(desc)) return 'claude';
    if (/gemini|google/.test(desc)) return 'gemini';
    if (/argon|wtu/.test(desc)) return 'gemini-argon';
    return 'other';
  }

  function quotaGroupLabel(group, langOrZh) {
    const kind = quotaGroupKind(group);
    if (kind === 'gemini-argon') return 'Gemini (Argon)';
    if (kind === 'claude') return 'Claude / GPT';
    if (kind === 'gemini') return 'Gemini';
    const raw = String(group?.name || group?.id || '').trim();
    if (raw) return raw;
    return pickByLang({ 'zh-CN': '模型配额', 'zh-TW': '模型配額', yue: '模型配額', en: 'Quota Pool', ja: 'クォータ' }, langOrZh);
  }

  function quotaRemaining(bucket) {
    if (!bucket || typeof bucket !== 'object' || bucket.available === false || bucket.disabled === true) return null;
    if (bucket.expired === true) return 1;
    const r = numOr(bucket.remaining ?? bucket.remainingFraction);
    if (typeof r === 'number' && Number.isFinite(r)) return Math.max(0, Math.min(1, r));
    if (typeof r === 'string' && r.trim() !== '' && Number.isFinite(Number(r))) {
      return Math.max(0, Math.min(1, Number(r)));
    }
    return null;
  }

  function quotaWindows(group) {
    if (!group || typeof group !== 'object') return [];
    const w5 = group.windows?.['5h'] || group.fiveHour || null;
    const ww = group.windows?.weekly || group.weekly || null;
    const out = [];
    if (w5 && quotaRemaining(w5) !== null) out.push(['5h', w5]);
    if (ww && quotaRemaining(ww) !== null) out.push(['weekly', ww]);
    return out;
  }

  function normalizeModelMatchKey(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/^select model,\s*current:\s*/i, '')
      .replace(/\b(?:extra\s+high|xhigh|high|medium|med|low|minimal|fast|thinking|off)\b/g, ' ')
      .replace(/[()\[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function groupMatchesModelDescription(group, normModel) {
    if (!normModel || normModel.length < 3) return false;
    const rawDesc = String(group?.description || '');
    if (!rawDesc) return false;
    const colonIdx = rawDesc.indexOf(':');
    const body = colonIdx >= 0 ? rawDesc.slice(colonIdx + 1) : rawDesc;
    const entries = body.split(/[,;\n]+/).map((s) => normalizeModelMatchKey(s)).filter((s) => s.length >= 3);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (normModel === e || normModel.startsWith(e + ' ') || e.startsWith(normModel + ' ')) return true;
    }
    return false;
  }

  function chooseQuotaGroup(groups, models, selectedId) {
    const list = Array.isArray(groups) ? groups.filter((g) => g && typeof g === 'object') : [];
    if (!list.length) return null;
    if (selectedId) {
      const hit = list.find((g) => g.id === selectedId || g.name === selectedId);
      if (hit) return hit;
    }
    const modelStr = (Array.isArray(models) ? models.join(' ') : String(models || '')).toLowerCase();
    const normModel = normalizeModelMatchKey(modelStr);
    if (/argon/.test(modelStr)) {
      const argon = list.find((g) => quotaGroupKind(g) === 'gemini-argon');
      if (argon) return argon;
    }
    if (normModel) {
      const descHit = list.find((g) => groupMatchesModelDescription(g, normModel));
      if (descHit) return descHit;
    }
    if (/argon/.test(modelStr)) {
      const gem = list.find((g) => quotaGroupKind(g) === 'gemini');
      if (gem) return gem;
    } else if (/claude|anthropic|sonnet|opus|haiku|gpt|openai|\bo[134]\b/.test(modelStr)) {
      const cld = list.find((g) => quotaGroupKind(g) === 'claude');
      if (cld) return cld;
    } else if (/gemini|neon|carbon|hydrogen|orchestrator|\bpro\b|flash/.test(modelStr)) {
      const gem = list.find((g) => quotaGroupKind(g) === 'gemini');
      if (gem) return gem;
      const argon = list.find((g) => quotaGroupKind(g) === 'gemini-argon');
      if (argon) return argon;
    }
    return list.find((g) => quotaWindows(g).length > 0) || list[0];
  }

  function shortEta(ms, langOrZh) {
    const l = resolveLang(langOrZh);
    const v = numOr(ms);
    if (!(v > 0) || !Number.isFinite(v)) {
      return pickByLang({ 'zh-CN': '即将刷新', 'zh-TW': '即將重設', yue: '就嚟重設', en: 'Refreshing', ja: '間もなく更新' }, l);
    }
    const totalSec = Math.max(1, Math.round(v / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (l === 'zh-CN') return d > 0 ? `${d}天${h}小时` : h > 0 ? `${h}小时${m}分` : `${Math.max(1, m)}分钟`;
    if (l === 'zh-TW') return d > 0 ? `${d}天${h}小時` : h > 0 ? `${h}小時${m}分` : `${Math.max(1, m)}分鐘`;
    if (l === 'yue') return d > 0 ? `${d}日${h}個鐘` : h > 0 ? `${h}個鐘${m}分` : `${Math.max(1, m)}分鐘`;
    if (l === 'ja') return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${m}分` : `${Math.max(1, m)}分`;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${Math.max(1, m)}m`;
  }

  function quotaForecast(bucket, windowKey, nowMs = Date.now()) {
    const rem = quotaRemaining(bucket);
    if (rem === null) return null;
    const now = numOr(nowMs);
    const spanMs = windowKey === 'weekly' ? 7 * 86400 * 1000 : 5 * 3600 * 1000;
    const r0 = numOr(bucket?.resetAt ?? bucket?.resetTime);
    const resetMs = typeof r0 === 'number' ? (r0 > 1e11 ? r0 : r0 * 1000) : (tsToMs(r0) || NaN);

    if (!Number.isFinite(resetMs) || resetMs <= now) {
      return {
        window: windowKey,
        remaining: rem,
        endRemaining: rem,
        forecastDrop: 0,
        willExhaust: false,
        exhaustInMs: null,
        paceRatio: 0,
        status: rem < 1 ? 'ok' : 'idle',
        resetAtMs: Number.isFinite(resetMs) ? resetMs : null,
        resetInMs: 0,
      };
    }

    const leftMs = Math.max(0, Math.min(spanMs, resetMs - now));
    const elapsedMs = Math.max(0, spanMs - leftMs);
    const used = Math.max(0, 1 - rem);
    const minSmoothMs = windowKey === 'weekly' ? 2 * 3600 * 1000 : 15 * 60 * 1000;

    if (used < 0.005 || elapsedMs < 3 * 60 * 1000) {
      return {
        window: windowKey,
        remaining: rem,
        endRemaining: rem,
        forecastDrop: 0,
        willExhaust: rem <= 0.005,
        exhaustInMs: rem <= 0.005 ? 0 : null,
        paceRatio: 0,
        status: rem <= 0.005 ? 'exhaust' : 'idle',
        resetAtMs: resetMs,
        resetInMs: leftMs,
      };
    }

    const burnPerMs = used / Math.max(elapsedMs, minSmoothMs);
    const projectedExtra = burnPerMs * leftMs;
    const endRemaining = Math.max(0, Math.min(rem, rem - projectedExtra));
    const forecastDrop = Math.max(0, rem - endRemaining);
    const idealUsed = spanMs > 0 ? elapsedMs / spanMs : 0;
    const paceRatio = idealUsed > 0.02 ? used / idealUsed : used / 0.02;
    const timeToZeroMs = burnPerMs > 0 ? rem / burnPerMs : Infinity;
    const willExhaust = rem <= 0.01 || (timeToZeroMs < leftMs * 0.95 && used >= 0.06);

    let status = 'ok';
    if (willExhaust) status = 'exhaust';
    else if (paceRatio > 1.18 && used >= 0.05) status = 'tight';
    else if (used < 0.01) status = 'idle';

    return {
      window: windowKey,
      remaining: rem,
      endRemaining,
      forecastDrop,
      willExhaust,
      exhaustInMs: Number.isFinite(timeToZeroMs) && willExhaust ? Math.max(0, Math.round(timeToZeroMs)) : null,
      paceRatio: Number(paceRatio.toFixed(2)),
      status,
      resetAtMs: resetMs,
      resetInMs: leftMs,
    };
  }

  function groupQuotaPace(group, langOrZh, nowMs = Date.now()) {
    const l = resolveLang(langOrZh);
    const wins = quotaWindows(group);
    const forecasts = wins.map(([wk, b]) => quotaForecast(b, wk, nowMs)).filter(Boolean);
    const rank = { exhaust: 3, tight: 2, ok: 1, idle: 0 };
    let primary = null;
    for (const f of forecasts) {
      if (!primary || (rank[f.status] ?? 0) > (rank[primary.status] ?? 0)) primary = f;
    }
    const status = primary ? primary.status : 'idle';
    const label = pickByLang(
      status === 'exhaust'
        ? { 'zh-CN': '提前耗尽', 'zh-TW': '提前耗盡', yue: '提早用晒', en: 'Depleting early', ja: '早期枯渇予測' }
        : status === 'tight'
        ? { 'zh-CN': '配速偏紧', 'zh-TW': '配速偏緊', yue: '進度偏緊', en: 'Burning fast', ja: '消費やや速め' }
        : status === 'ok'
        ? { 'zh-CN': '配额充裕', 'zh-TW': '配額充裕', yue: '配額充裕', en: 'On track', ja: 'ペース良好' }
        : { 'zh-CN': '待命充裕', 'zh-TW': '待命充裕', yue: '待命充裕', en: 'Standby', ja: '待機中' },
      l
    );
    let detail = '';
    if (primary) {
      if (primary.willExhaust && primary.exhaustInMs !== null) {
        const eta = shortEta(primary.exhaustInMs, l);
        detail = pickByLang(
          {
            'zh-CN': `预计 ${eta}后耗尽`,
            'zh-TW': `預計 ${eta}後耗盡`,
            yue: `預計 ${eta}後用晒`,
            en: `Est. empty in ${eta}`,
            ja: `約${eta}で枯渇予測`,
          },
          l
        );
      } else if (primary.resetInMs > 0) {
        const eta = shortEta(primary.resetInMs, l);
        const endPct = Math.round(primary.endRemaining * 100);
        detail = pickByLang(
          {
            'zh-CN': `${eta}后重置 · 预计结余 ${endPct}%`,
            'zh-TW': `${eta}後重設 · 預計結餘 ${endPct}%`,
            yue: `${eta}後重設 · 預計剩 ${endPct}%`,
            en: `Resets in ${eta} · Est. ${endPct}% left`,
            ja: `${eta}後に更新 · 予測残 ${endPct}%`,
          },
          l
        );
      }
    }
    return {
      status,
      label,
      detail,
      primary,
      forecasts,
    };
  }

  function axisMax(peak) {
    const p = numOr(peak);
    if (!(p > 0)) return 0;
    const magnitude = Math.pow(10, Math.floor(Math.log(p) / Math.LN10));
    const scaled = p / magnitude;
    const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function homeChartTicks(widths, axisWidth, gap = 8, columnGap = 2) {
    const count = widths.length;
    if (count === 0 || !(axisWidth > 0)) return [];
    const column = (axisWidth - columnGap * (count - 1)) / count;
    if (!(column > 0)) return [];
    let widest = 0;
    for (let i = 0; i < count; i++) {
      if (widths[i] > widest) widest = widths[i];
    }
    const edgeShift = Math.max(0, widest / 2 - column / 2);
    let step = 1;
    while (step < count && step * (column + columnGap) < widest + gap + edgeShift) step += 1;
    const boxes = [];
    for (let i = count - 1; i >= 0; i -= step) {
      const width = widths[i];
      const centre = i * (column + columnGap) + column / 2;
      const left = Math.min(Math.max(centre - width / 2, 0), Math.max(axisWidth - width, 0));
      boxes.unshift({ index: i, left });
    }
    const kept = [];
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      const next = kept[0];
      if (next === undefined || box.left + widths[box.index] + gap <= next.left) kept.unshift(box);
    }
    return kept;
  }

  function createHomeModelColours() {
    const assigned = new Map();
    function preferred(id) {
      let hash = 2166136261;
      for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
      return (hash >>> 0) % HOME_MODEL_COLOUR_COUNT;
    }
    return function assign(ids) {
      const unique = Array.from(new Set(ids)).sort();
      const out = {};
      for (let i = 0; i < unique.length; i++) {
        const id = unique[i];
        if (assigned.has(id)) {
          out[id] = assigned.get(id);
          continue;
        }
        const used = new Set(assigned.values());
        let colour = preferred(id);
        while (used.size < HOME_MODEL_COLOUR_COUNT && used.has(colour)) {
          colour = (colour + 1) % HOME_MODEL_COLOUR_COUNT;
        }
        assigned.set(id, colour);
        out[id] = colour;
      }
      return out;
    };
  }

  function durSec(d) {
    if (!d) return 0;
    return typeof d === 'object' ? toNum(d.seconds) + toNum(d.nanos) / 1e9 : toNum(d);
  }

  function tsSec(ts) {
    if (!ts) return 0;
    if (typeof ts === 'string') { const ms = Date.parse(ts); return Number.isFinite(ms) ? ms / 1000 : toNum(ts); }
    return typeof ts === 'object' ? toNum(ts.seconds) + toNum(ts.nanos) / 1e9 : toNum(ts);
  }

  function fmtK(n) {
    const v = toNum(n);
    if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(Math.round(v));
  }

  function fmtInt(n) {
    return toNum(n).toLocaleString();
  }

  function fmtPct(p, digits = 1) {
    const v = toNum(p);
    return v.toFixed(digits) + '%';
  }

  function fmtSec(s) {
    const v = toNum(s);
    if (v <= 0) return '—';
    if (v < 1) return Math.round(v * 1000) + 'ms';
    return v.toFixed(1) + 's';
  }

  function fmtResetTime(tsSeconds, langOrZh, nowSec) {
    const n0 = numOr(nowSec);
    const now = typeof n0 === 'number' ? n0 : Date.now() / 1000;
    const sec = (tsSeconds && typeof tsSeconds === 'object' ? tsSec(tsSeconds) : toNum(tsSeconds)) - now;
    const l = resolveLang(langOrZh);
    if (sec <= 0) {
      return pickByLang({ 'zh-CN': '即将刷新', 'zh-TW': '即將重設', yue: '就嚟重設', en: 'Refreshing', ja: '間もなく更新' }, l);
    }
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (l === 'zh-CN') return d > 0 ? `${d}天${h}小时` : h > 0 ? `${h}小时${m}分` : `${Math.max(1, m)}分钟`;
    if (l === 'zh-TW') return d > 0 ? `${d}天${h}小時` : h > 0 ? `${h}小時${m}分` : `${Math.max(1, m)}分鐘`;
    if (l === 'yue') return d > 0 ? `${d}日${h}個鐘` : h > 0 ? `${h}個鐘${m}分` : `${Math.max(1, m)}分鐘`;
    if (l === 'ja') return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${m}分` : `${Math.max(1, m)}分`;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${Math.max(1, m)}m`;
  }

  return {
    HOME_HEAT_WEEKS,
    HOME_HEAT_RAMP,
    HOME_HEAT_STEPS,
    HOME_CHART_DAYS,
    HOME_MODEL_ROWS,
    HOME_RANGES,
    HOME_BOOKS,
    resolveLang,
    homeRangeLabel,
    homeBookTitle,
    homeDayKey,
    homeRangeStart,
    formatHomeCount,
    formatCompactTokens,
    formatHomeHour,
    homeShortDateFormat,
    homeShortDate,
    isSubagentSummary,
    extractWorkspaceId,
    analyzeTrajectoryForUsage,
    mergeUsageRecordDelta,
    homeHeatGrid,
    aggregateUsageRollup,
    quotaGroupKind,
    quotaGroupLabel,
    quotaRemaining,
    quotaWindows,
    chooseQuotaGroup,
    shortEta,
    quotaForecast,
    groupQuotaPace,
    axisMax,
    homeChartTicks,
    createHomeModelColours,
    durSec,
    tsSec,
    fmtK,
    fmtInt,
    fmtPct,
    fmtSec,
    fmtResetTime,
  };
});
