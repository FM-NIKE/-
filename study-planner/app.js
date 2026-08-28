/* 学习计划 PWA —— 数据都在 localStorage,只存本机 */

const STORE_KEY = 'studyPlan.blocks.v1';

let blocks = load();
let addType = 'study'; // 当前添加表单选中的类型

/* ---------- 数据 ---------- */

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
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
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
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
  document.getElementById('totalStudy').textContent = studyTotal;
  document.getElementById('totalRest').textContent = restTotal;
  document.getElementById('blockCount').textContent = blocks.length;

  const nowIdx = sorted.findIndex(b =>
    nowMin >= hmToMin(b.start) && nowMin < hmToMin(b.start) + b.dur);

  document.getElementById('timeline').innerHTML = sorted.map((b, i) => {
    const startMin = hmToMin(b.start);
    const endMin = startMin + b.dur;
    const isStudy = b.type === 'study';
    const cls = ['block', b.type];
    if (i === nowIdx) cls.push('now');
    if (endMin <= nowMin) cls.push('past');
    const title = b.label ? esc(b.label) : (isStudy ? '学习' : '休息');
    return `
      <div class="${cls.join(' ')}">
        ${i === nowIdx ? '<span class="block-now-tag">现在</span>' : ''}
        <div class="block-icon">${isStudy ? '📚' : '☕'}</div>
        <div class="block-info">
          <div class="block-title">${title}</div>
          <div class="block-sub">${isStudy ? '学习' : '休息'} ${b.dur} 分钟</div>
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
  const dur = parseInt(document.getElementById('duration').value, 10);
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
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
});

// 时长快捷选择
document.querySelectorAll('.chip').forEach(c =>
  c.addEventListener('click', () => {
    document.getElementById('duration').value = c.dataset.min;
  }));

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
fired = Object.fromEntries(Object.entries(fired).filter(([k]) => k.startsWith(todayStr()))); // 清掉非今天的

function markFired(key) {
  fired[todayStr() + '|' + key] = true;
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
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

function checkReminders() {
  const now = new Date();
  const nowTs = now.getTime();
  for (const b of blocks) {
    const s = new Date(); s.setHours(...b.start.split(':').map(Number), 0, 0);
    const eTs = s.getTime() + b.dur * 60000;
    if (nowTs >= s.getTime() && !fired[todayStr() + '|' + b.id + '|start']) {
      markFired(b.id + '|start');
      const isStudy = b.type === 'study';
      const name = b.label || (isStudy ? '学习时间' : '休息时间');
      const title = isStudy ? '📚 该学习了!' : '☕ 该休息了!';
      const body = isStudy
        ? `${name} ${b.start} 开始,计划学 ${b.dur} 分钟,加油!`
        : `休息 ${b.dur} 分钟,起来活动一下吧~`;
      showModal(b.type === 'study' ? '📚' : '☕', title, body);
      systemNotify(title, body);
    }
    if (nowTs >= eTs && !fired[todayStr() + '|' + b.id + '|end']) {
      markFired(b.id + '|end');
      if (b.type === 'study') {
        const name = b.label || '这轮学习';
        showModal('🎉', '学习时间结束!', `${name}结束啦,休息一下吧~`);
        systemNotify('🎉 学习时间结束', '休息一下吧~');
      }
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

/* ---------- 启动 ---------- */

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
checkReminders();
setInterval(checkReminders, 20000);   // 每 20 秒检查一次到点
setInterval(render, 60000);           // 每分钟刷新"现在"高亮
