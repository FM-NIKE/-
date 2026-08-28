/* 学习计划 PWA —— 数据都在 localStorage,只存本机 */

const STORE_KEY = 'studyPlan.blocks.v1';
const SETTINGS_KEY = 'studyPlan.settings.v1';

let blocks = load();
let addType = 'study'; // 当前添加表单选中的类型

/* ---------- 设置(右上角 ⚙️) ---------- */

let settings = { unit: 'min' }; // 时长显示单位:min=分钟 / hour=小时
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch {}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 把分钟数按当前单位格式化成显示文本,如 "90" -> "1时30分"
function fmtDur(mins) {
  if (mins === 0) return '0分钟';
  if (settings.unit === 'hour') {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (m === 0) return h + '小时';
    if (h === 0) return m + '分钟';
    return h + '时' + m + '分';
  }
  return String(mins);
}

/* ---------- 数据 ---------- */

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(blocks));
}

/* ---------- 工具 ---------- */

function hmToMin(hm) { // "09:30" -> 570
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}
function minToHm(min) { // 570 -> "09:30"
  min = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}
function esc(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- 渲染 ---------- */

function render() {
  const sorted = [...blocks].sort((a, b) => hmToMin(a.start) - hmToMin(b.start));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const studyTotal = blocks.filter(b => b.type === 'study').reduce((s, b) => s + b.dur, 0);
  const restTotal = blocks.filter(b => b.type === 'rest').reduce((s, b) => s + b.dur, 0);
  const inHour = settings.unit === 'hour';
  const studyEl = document.getElementById('totalStudy');
  const restEl = document.getElementById('totalRest');
  studyEl.textContent = inHour ? fmtDur(studyTotal) : studyTotal;
  restEl.textContent = inHour ? fmtDur(restTotal) : restTotal;
  studyEl.classList.toggle('small', inHour && fmtDur(studyTotal).length > 4);
  restEl.classList.toggle('small', inHour && fmtDur(restTotal).length > 4);
  document.querySelector('.sum-card:nth-child(1) .sum-label').textContent =
    inHour ? '规划学习' : '规划学习(分钟)';
  document.querySelector('.sum-card:nth-child(2) .sum-label').textContent =
    inHour ? '休息' : '休息(分钟)';
  document.getElementById('blockCount').textContent = blocks.length;

  const nowIdx = sorted.findIndex(b => {
    // 跨午夜的块(如 23:50–0:20):把当前时间加一天再比较
    const startM = hmToMin(b.start);
    const effNow = nowMin < startM ? nowMin + 1440 : nowMin;
    return effNow >= startM && effNow < startM + b.dur;
  });

  document.getElementById('timeline').innerHTML = sorted.map((b, i) => {
    const startMin = hmToMin(b.start);
    const effNow = nowMin < startMin ? nowMin + 1440 : nowMin;
    const endMin = startMin + b.dur;
    const isStudy = b.type === 'study';
    const cls = ['block', b.type];
    if (i === nowIdx) cls.push('now');
    if (endMin <= effNow) cls.push('past');
    const title = b.label ? esc(b.label) : (isStudy ? '学习' : '休息');
    return `
      <div class="${cls.join(' ')}">
        ${i === nowIdx ? '<span class="block-now-tag">现在</span>' : ''}
        <div class="block-icon">${isStudy ? '📚' : '☕'}</div>
        <div class="block-info">
          <div class="block-title">${title}</div>
          <div class="block-sub">${isStudy ? '学习' : '休息'} ${settings.unit === 'hour' ? fmtDur(b.dur) : b.dur + ' 分钟'}</div>
        </div>
        <div class="block-time">${b.start} – ${minToHm(endMin)}</div>
        <button class="block-del" data-id="${b.id}" aria-label="删除">✕</button>
      </div>`;
  }).join('');

  document.getElementById('emptyHint').classList.toggle('hidden', blocks.length > 0);

  const now = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  document.getElementById('todayDate').textContent =
    `${now.getMonth() + 1}月${now.getDate()}日 星期${week}`;
}

/* ---------- 添加 / 删除 ---------- */

function addBlock() {
  const start = document.getElementById('startTime').value;
  const durInput = parseFloat(document.getElementById('duration').value);
  // 统一取整到整分钟,避免 90.5 这种小数分钟弄坏时间显示
  const dur = Math.round(settings.unit === 'hour' ? durInput * 60 : durInput);
  if (!start || !dur || dur < 1) return alert('请填写开始时间和时长');
  blocks.push({
    id: Date.now() + '' + Math.floor(Math.random() * 1000),
    type: addType, start, dur,
    label: document.getElementById('label').value.trim()
  });
  save();
  document.getElementById('label').value = '';
  // 便利:下一块默认从这块结束的时间开始
  document.getElementById('startTime').value = minToHm(hmToMin(start) + dur);
  render();
}

document.getElementById('addBtn').addEventListener('click', addBlock);
document.getElementById('duration').addEventListener('keydown', e => { if (e.key === 'Enter') addBlock(); });

document.getElementById('timeline').addEventListener('click', e => {
  const id = e.target.dataset && e.target.dataset.id;
  if (!id) return;
  blocks = blocks.filter(b => b.id !== id);
  save();
  render();
});

// 类型切换
document.getElementById('typeSeg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  addType = btn.dataset.type;
  document.querySelectorAll('#typeSeg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
});

// 时长快捷选择(按当前单位显示,内部统一存分钟)
const CHIP_SETS = {
  min: [20, 30, 45, 60, 90],
  hour: [30, 60, 90, 120, 180] // 显示为 0.5 / 1 / 1.5 / 2 / 3 小时
};
const chipsBox = document.querySelector('.chips');
function renderChips() {
  chipsBox.innerHTML = CHIP_SETS[settings.unit].map(m => {
    const text = settings.unit === 'hour' ? String(+(m / 60).toFixed(2)) : m;
    return `<button class="chip" data-min="${m}">${text}</button>`;
  }).join('');
  document.querySelector('label:has(#duration)').childNodes[0].textContent =
    settings.unit === 'hour' ? '时长(小时)' : '时长(分钟)';
  const durInput = document.getElementById('duration');
  durInput.step = settings.unit === 'hour' ? '0.25' : '1';
}
chipsBox.addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  document.getElementById('duration').value =
    settings.unit === 'hour' ? c.dataset.min / 60 : c.dataset.min;
});
renderChips();
// 启动时若处于小时模式,把输入框默认的分钟数值换算成小时
if (settings.unit === 'hour') {
  const d = document.getElementById('duration');
  const v = parseFloat(d.value);
  if (v > 0) d.value = +(v / 60).toFixed(2);
}

// 接着上一块
document.getElementById('chainBtn').addEventListener('click', () => {
  if (!blocks.length) return alert('还没有时间块');
  const last = Math.max(...blocks.map(b => hmToMin(b.start) + b.dur));
  document.getElementById('startTime').value = minToHm(last);
});

/* ---------- 到点提醒 ---------- */

const FIRED_KEY = 'studyPlan.fired.v1';
let fired = {};
try { fired = JSON.parse(localStorage.getItem(FIRED_KEY)) || {}; } catch {}

// 数据日以凌晨 4 点为界:0~4 点仍算前一天,4 点起算新的一天。
// 每天跨过凌晨 4 点时,清空全部数据(计划的时间块 + 提醒记录),从零开始新的一天。
function dataDayStr() {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

const DAY_KEY = 'studyPlan.day.v1';
let currentDay = dataDayStr();

function resetAllData() {
  blocks = [];
  save();
  fired = {};
  localStorage.removeItem(FIRED_KEY);
  localStorage.setItem(DAY_KEY, currentDay);
  render();
}

// 启动时:如果上次使用是在之前的数据日,说明已经跨过了凌晨 4 点,清空全部数据
if (localStorage.getItem(DAY_KEY) !== currentDay) {
  resetAllData();
}

function markFired(key) {
  fired[currentDay + '|' + key] = true;
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}

function hasFired(key) {
  return !!fired[currentDay + '|' + key];
}

function showModal(icon, title, body) {
  document.getElementById('modalIcon').textContent = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  document.getElementById('modal').classList.remove('hidden');
  beep();
}
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56].forEach(delay => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.25);
    });
  } catch {}
}

function systemNotify(title, body) {
  if (Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body, sound: 'default' }); } catch {}
  }
}

// 只提醒"刚刚到点"的事件:到点 90 秒内才算有效提醒。
// 超过 90 秒才被检查到的(比如补排的过去时间块、长时间没开 App)一律静默跳过,
// 避免一设好就弹"时间到了"。
const GRACE_MS = 90 * 1000;

function checkReminders() {
  // 跨过凌晨 4 点:清空全部数据(计划 + 提醒记录),开始新的一天
  const day = dataDayStr();
  if (day !== currentDay) {
    currentDay = day;
    resetAllData();
  }

  const now = new Date();
  const nowTs = now.getTime();
  for (const b of blocks) {
    const s = new Date(); s.setHours(...b.start.split(':').map(Number), 0, 0);
    const startTs = s.getTime();
    const endTs = startTs + b.dur * 60000;
    const isStudy = b.type === 'study';
    const name = b.label || (isStudy ? '学习时间' : '休息时间');

    const startKey = b.id + '|start';
    if (nowTs >= startTs && !hasFired(startKey)) {
      if (nowTs - startTs <= GRACE_MS) {
        const durText = settings.unit === 'hour' ? fmtDur(b.dur) : b.dur + ' 分钟';
        const title = isStudy ? '📚 该学习了!' : '☕ 该休息了!';
        const body = isStudy
          ? `${name} ${b.start} 开始,计划学 ${durText},加油!`
          : `休息 ${durText},起来活动一下吧~`;
        showModal(isStudy ? '📚' : '☕', title, body);
        systemNotify(title, body);
      }
      markFired(startKey);
    }

    const endKey = b.id + '|end';
    if (nowTs >= endTs && !hasFired(endKey)) {
      if (isStudy && nowTs - endTs <= GRACE_MS) {
        showModal('🎉', '学习时间结束!', `${name}结束啦,休息一下吧~`);
        systemNotify('🎉 学习时间结束', '休息一下吧~');
      }
      markFired(endKey);
    }
  }
}

/* ---------- 设置区 ---------- */

document.getElementById('notifyBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('此浏览器不支持系统通知,App 内弹窗提醒仍然有效');
  const p = await Notification.requestPermission();
  alert(p === 'granted'
    ? '系统通知已开启!App 在前台时会有弹窗 + 声音提醒。'
    : '你拒绝了通知权限,只能在打开 App 时看到弹窗提醒。');
  if (p === 'granted') {
    try { new Notification('🔔 提醒已开启', { body: '到学习/休息时间会通知你' }); } catch {}
  }
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('确定清空所有时间块吗?')) {
    blocks = []; save(); render();
  }
});

/* ---------- 设置弹窗 ---------- */

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.querySelectorAll('#unitSeg .seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.unit === settings.unit));
  document.getElementById('settingsModal').classList.remove('hidden');
});
document.getElementById('settingsClose').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.add('hidden');
});
document.getElementById('unitSeg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn || btn.dataset.unit === settings.unit) return;
  // 切换单位时,把输入框里已填的数值也换算过去(分钟 <-> 小时)
  const durInput = document.getElementById('duration');
  const v = parseFloat(durInput.value);
  if (v > 0) {
    durInput.value = btn.dataset.unit === 'hour' ? +(v / 60).toFixed(2) : Math.round(v * 60);
  }
  settings.unit = btn.dataset.unit;
  saveSettings();
  renderChips();
  render();
});

/* ---------- 启动 ---------- */

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
checkReminders();
setInterval(checkReminders, 20000);   // 每 20 秒检查一次到点
setInterval(render, 60000);           // 每分钟刷新"现在"高亮
