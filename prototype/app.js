/* AstroVital — UI layer. Depends on engine.js (window.Engine). */
(function () {
  'use strict';
  const E = window.Engine;
  const { METRICS, DOMAINS, SYMPTOMS, LEVEL_LABEL } = E;
  const U = E.util;
  const STORE_KEY = 'astrovital.v1';

  // ------------------------------------------------------------ state & storage
  let state = load();
  let currentTab = 'dashboard';
  let trendMetric = 'hr';
  let trendRange = 60;
  let checkinDate = U.todayStr();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { settings: Object.assign({}, E.DEFAULT_SETTINGS, s.settings), entries: s.entries || [] };
      }
    } catch (e) { /* storage unavailable — run in memory */ }
    return { settings: Object.assign({}, E.DEFAULT_SETTINGS), entries: [] };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save to local storage — export your data to keep it.'); }
  }
  const entryFor = date => state.entries.find(e => e.date === date);
  function upsert(entry) {
    const i = state.entries.findIndex(e => e.date === entry.date);
    if (i >= 0) state.entries[i] = entry; else state.entries.push(entry);
    state.entries = U.sortEntries(state.entries);
    save();
  }

  // ------------------------------------------------------------ utils
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pill = lvl => `<span class="pill ${lvl}">${LEVEL_LABEL[lvl]}</span>`;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3500);
  }
  function modal(title, html) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const evaluate = () => E.evaluate(state.entries, state.settings);

  // ------------------------------------------------------------ charts (inline SVG, no deps)
  function sparkline(vals) {
    const v = vals.filter(U.isNum);
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
    const pts = v.map((y, i) => `${(i / (v.length - 1) * 100).toFixed(1)},${(26 - (y - min) / r * 22).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function lineChart(points, opts) {
    // points: [{x (number), y, date}]
    const W = 860, H = 280, L = 52, R = 14, T = 14, B = 30;
    if (points.length < 2) return '<p class="muted">Not enough data yet — record at least two check-ins.</p>';
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    let ymin = Math.min(...ys), ymax = Math.max(...ys);
    if (opts.band) { ymin = Math.min(ymin, opts.band.lo); ymax = Math.max(ymax, opts.band.hi); }
    const padY = (ymax - ymin) * 0.08 || 1; ymin -= padY; ymax += padY;
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const sx = x => L + (x - xmin) / (xmax - xmin || 1) * (W - L - R);
    const sy = y => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const yv = ymin + (ymax - ymin) * i / 4, y = sy(yv);
      g += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="axis" x="${L - 6}" y="${y + 4}" text-anchor="end">${yv.toFixed(opts.dec)}</text>`;
    }
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const idx = Math.round(i / ticks * (points.length - 1)), p = points[idx];
      g += `<text class="axis" x="${sx(p.x)}" y="${H - 8}" text-anchor="middle">${p.x >= 1 || p.x <= 0 ? 'D' + p.x : p.date.slice(5)}</text>`;
    }
    if (opts.band) {
      g += `<rect class="band" x="${L}" width="${W - L - R}" y="${sy(opts.band.hi)}" height="${Math.max(0, sy(opts.band.lo) - sy(opts.band.hi))}"/>`;
      g += `<line class="base" x1="${L}" x2="${W - R}" y1="${sy(opts.band.mean)}" y2="${sy(opts.band.mean)}"/>`;
    }
    if (xmin < 1 && xmax >= 1) g += `<line class="launch" x1="${sx(1)}" x2="${sx(1)}" y1="${T}" y2="${H - B}"/><text class="axis" x="${sx(1) + 4}" y="${T + 10}">launch</text>`;
    g += `<path class="line" d="${points.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ')}"/>`;
    const r = points.length > 120 ? 1.8 : 2.8;
    for (const p of points) {
      const out = opts.band && (p.y > opts.band.hi || p.y < opts.band.lo);
      g += `<circle class="pt${out ? ' out' : ''}" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${out ? r + 0.8 : r}"><title>${p.date} (day ${p.x}): ${p.y.toFixed(opts.dec)} ${opts.unit}</title></circle>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)} trend">${g}</svg>`;
  }

  // ------------------------------------------------------------ header
  function renderHeader() {
    const s = state.settings, last = state.entries[state.entries.length - 1];
    const ref = last ? last.date : U.todayStr();
    const d = U.missionDay(ref, s);
    $('#missionBadge').textContent = s.missionStart
      ? `${s.crewName} · ${d >= 1 ? `MD ${d}/${s.missionLength}` : `L${d - 1}`}`
      : s.crewName;
  }

  // ------------------------------------------------------------ DASHBOARD
  function renderDashboard() {
    if (!state.entries.length) {
      return `<div class="panel welcome">
        <h1>Your health, your baseline.</h1>
        <p>AstroVital learns what's normal <em>for you</em> from preflight check-ins, then flags drift in cardiovascular, bone &amp; muscle, immune, behavioral, radiation and environmental indicators — with clear actions you can take on board, even with no link to the ground.</p>
        <div class="btn-row"><button class="btn primary" data-go="checkin">Start first check-in</button><button class="btn" data-action="demo">Load demo mission (124 days)</button></div>
      </div>`;
    }
    const r = evaluate();
    const n = r.findings.length, nEsc = r.findings.filter(f => f.escalate).length;
    const headline = {
      ok: 'All indicators are within your personal baseline.',
      watch: `${n} item${n > 1 ? 's' : ''} to keep an eye on. Self-care actions below.`,
      act: `${r.findings.filter(f => f.level === 'act').length} item(s) need action now${nEsc ? ` · ${nEsc} flagged for flight-surgeon review` : ''}.`,
    }[r.overall];
    const stale = U.diffDays(U.todayStr(), r.latest.date);

    let html = `<section class="hero ${r.overall}">
      <div><div class="muted small">Overall status</div><div class="big">${LEVEL_LABEL[r.overall]}</div></div>
      <div class="grow"><div>${headline}</div>
        <div class="muted small">Last check-in ${esc(r.latest.date)}${stale > 0 ? ` (${stale} day${stale > 1 ? 's' : ''} ago)` : ' (today)'} · baseline from ${r.baseline.n} ${r.baseline.source}</div></div>
      <div class="btn-row"><button class="btn primary" data-go="checkin">Daily check-in</button><button class="btn" data-action="report">Downlink report</button></div>
    </section>`;

    html += `<div class="domains">${Object.entries(DOMAINS).map(([k, d]) => {
      const dom = r.domains[k];
      const top = dom.findings[0];
      return `<button class="domain ${dom.level}" data-domain="${k}" title="${esc(d.blurb)}">
        <h3>${d.name}</h3>${pill(dom.level)}
        <p>${top ? esc(top.title) + (dom.findings.length > 1 ? ` +${dom.findings.length - 1}` : '') : 'Within baseline'}</p></button>`;
    }).join('')}</div>`;

    html += `<div class="grid grid-2"><section class="panel" id="actionPlan"><div class="panel-head"><h2>Action plan</h2><span class="muted small">most urgent first</span></div>`;
    html += r.findings.length ? r.findings.map(findingHtml).join('') : `<div class="empty-ok">✓ Nothing to act on. Keep up countermeasures and check in tomorrow.</div>`;
    html += `</section><div class="stack">`;

    // latest readings tiles
    const tileKeys = ['hr', 'sbp', 'spo2', 'temp', 'weight', 'sleep', 'resistance', 'mood', 'pvt'];
    const last14 = state.entries.slice(-14);
    html += `<section class="panel"><div class="panel-head"><h2>Latest readings</h2><span class="muted small">Δ vs. your baseline · 14-day spark</span></div><div class="tiles">`;
    for (const k of tileKeys) {
      const m = METRICS[k], v = r.latest[k], b = r.baseline.metrics[k];
      const z = b && U.isNum(v) ? (v - b.mean) / b.sd : null;
      const delta = b && U.isNum(v) ? v - b.mean : null;
      html += `<div class="tile" data-metric="${k}"><div class="lbl">${m.short}</div>
        <div class="val">${k === 'sbp' && U.isNum(v) ? `${v}/${r.latest.dbp ?? '—'}` : U.fmt(k, v)}<small>${m.unit}</small></div>
        <div class="delta ${z !== null && Math.abs(z) >= 2 ? 'flag' : 'muted'}">${delta === null ? 'no baseline' : (delta >= 0 ? '+' : '') + delta.toFixed(m.dec) + ` (${z >= 0 ? '+' : ''}${z.toFixed(1)}σ)`}</div>
        ${sparkline(last14.map(e => e[k]))}</div>`;
    }
    html += `</div></section>`;

    // radiation
    if (r.radiation) {
      const rad = r.radiation, s = state.settings, L = rad.limit;
      const w = v => Math.min(100, v / L * 100).toFixed(1) + '%';
      html += `<section class="panel"><div class="panel-head"><h2>Radiation exposure</h2>${pill(r.domains.radiation.level)}</div>
        <div class="meter" title="Career dose vs limit">
          <span class="proj" style="width:${w(rad.projected)}"></span>
          <span class="mission" style="width:${w(rad.career)}"></span>
          <span class="prior" style="width:${w(s.priorCareerDose)}"></span>
        </div>
        <div class="legend"><span><i style="background:var(--muted);opacity:.5"></i>prior missions</span><span><i style="background:var(--accent)"></i>this mission</span><span><i style="border-right:2px dashed var(--watch)"></i>projected at mission end</span></div>
        <div class="kv">
          <div><span>Mission dose</span><b>${rad.missionDose.toFixed(1)} mSv</b></div>
          <div><span>Career total</span><b>${rad.career.toFixed(0)} / ${L} mSv</b></div>
          <div><span>Avg rate</span><b>${rad.rate.toFixed(2)} mSv/d</b></div>
          <div><span>Projected</span><b>${rad.projected.toFixed(0)} mSv</b></div>
        </div></section>`;
    }
    html += `</div></div>`;
    return html;
  }

  function findingHtml(f) {
    return `<div class="finding ${f.level}">
      <div class="finding-head">${pill(f.level)}<strong>${esc(f.title)}</strong>${f.escalate ? '<span class="tag">Notify surgeon</span>' : ''}</div>
      <p><span class="muted">${DOMAINS[f.domain].name} ·</span> ${esc(f.detail)}</p>
      <ul>${f.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  }

  function showDomain(k) {
    const r = evaluate(), d = r.domains[k];
    modal(DOMAINS[k].name, `<p class="muted">${esc(DOMAINS[k].blurb)}</p>${d.findings.length ? d.findings.map(findingHtml).join('') : '<div class="empty-ok">✓ All indicators in this domain are within your baseline.</div>'}`);
  }

  function showReport() {
    const text = E.buildReport(state.entries, state.settings);
    modal('Downlink health report', `<p class="muted small">Compact text summary for transmission to the flight surgeon — designed for low-bandwidth, delayed comms.</p>
      <textarea class="report" readonly>${esc(text)}</textarea>
      <div class="btn-row" style="margin-top:10px"><button class="btn primary" data-action="copy-report">Copy</button><button class="btn" data-action="dl-report">Download .txt</button></div>`);
  }

  // ------------------------------------------------------------ CHECK-IN
  const numField = (k, e) => {
    const m = METRICS[k];
    return `<div class="field"><label for="f-${k}">${m.label}${m.unit && m.unit !== '/5' ? ` (${m.unit})` : ''}</label>
      <input type="number" id="f-${k}" name="${k}" min="${m.min}" max="${m.max}" step="${m.step}" value="${e && U.isNum(e[k]) ? e[k] : ''}" inputmode="decimal"></div>`;
  };
  const scaleField = (k, e, lo, hi) => {
    const m = METRICS[k];
    return `<div class="field"><label>${m.label.split(' (')[0]} <span class="hint">${lo} → ${hi}</span></label><div class="scale" role="radiogroup">
      ${[1, 2, 3, 4, 5].map(v => `<label><input type="radio" name="${k}" value="${v}" ${e && e[k] === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>`;
  };

  function renderCheckin() {
    const e = entryFor(checkinDate);
    const md = U.missionDay(checkinDate, state.settings);
    const syms = new Set(e ? e.symptoms : []);
    const groups = {};
    for (const s of SYMPTOMS) (groups[s.domain] = groups[s.domain] || []).push(s);
    return `<form class="panel" id="checkinForm" autocomplete="off">
      <div class="panel-head"><div><h2>${e ? 'Edit' : 'New'} daily check-in</h2>
        <div class="muted small">${md !== null ? (md >= 1 ? `Mission day ${md}` : `Preflight (L${md - 1}) — builds your personal baseline`) : 'Set a mission start date in Settings to track mission days'} · takes about 2 minutes</div></div>
        <div class="field"><label for="f-date">Date</label><input type="date" id="f-date" name="date" value="${checkinDate}" required></div></div>

      <div class="form-section"><h2>Vitals</h2><div class="form-grid">
        ${['hr', 'sbp', 'dbp', 'spo2', 'temp', 'weight'].map(k => numField(k, e)).join('')}</div></div>

      <div class="form-section"><h2>Countermeasures &amp; recovery</h2><div class="form-grid">
        ${['sleep', 'resistance', 'aerobic', 'fluid'].map(k => numField(k, e)).join('')}</div>
        <p class="muted small">Targets: resistance ${state.settings.resistanceTarget} min · aerobic ${state.settings.aerobicTarget} min · fluid ${state.settings.fluidTarget} L per day.</p></div>

      <div class="form-section"><h2>How are you doing?</h2><div class="form-grid">
        ${scaleField('mood', e, 'very low', 'great')}${scaleField('stress', e, 'calm', 'very high')}${scaleField('fatigue', e, 'fresh', 'exhausted')}</div></div>

      <div class="form-section"><h2>Alertness &amp; radiation</h2><div class="form-grid">
        ${numField('pvt', e)}${numField('lapses', e)}${numField('dose', e)}
        <div class="field"><label>&nbsp;</label><button type="button" class="btn" data-go="pvt">Run alertness test →</button></div></div>
        <p class="muted small">Dose: from your personal dosimeter or the module's radiation monitor.</p></div>

      <div class="form-section"><h2>Symptoms today</h2>
        ${Object.entries(groups).map(([d, list]) => `<div class="sym-group"><h3>${DOMAINS[d].name}</h3><div class="checks">
          ${list.map(s => `<label class="check${s.level === 'act' ? ' red' : ''}"><input type="checkbox" name="sym" value="${s.id}" ${syms.has(s.id) ? 'checked' : ''}>${esc(s.label)}</label>`).join('')}</div></div>`).join('')}
      </div>

      <div class="form-section"><h2>Notes</h2><textarea name="notes" placeholder="Anything else — context for yourself or the flight surgeon">${esc(e ? e.notes : '')}</textarea></div>

      <div class="btn-row" style="margin-top:16px"><button type="submit" class="btn primary">Save check-in</button>
        ${e ? '<button type="button" class="btn danger" data-action="delete-entry">Delete this entry</button>' : ''}</div>
    </form>`;
  }

  function saveCheckin(form) {
    const fd = new FormData(form);
    const entry = { date: fd.get('date'), symptoms: fd.getAll('sym') };
    if (!entry.date) return toast('Please choose a date.');
    for (const k of Object.keys(METRICS)) {
      const raw = fd.get(k);
      if (raw === null || raw === '') continue;
      const v = Number(raw);
      if (!isFinite(v)) continue;
      const m = METRICS[k];
      if (v < m.min || v > m.max) return toast(`${m.label}: ${v} is outside the plausible range (${m.min}–${m.max}). Please re-check.`);
      entry[k] = v;
    }
    const notes = (fd.get('notes') || '').trim();
    if (notes) entry.notes = notes;
    if (!state.settings.missionStart && !state.entries.length) {
      // first-ever entry: assume flight is ongoing from today so mission-day logic works
      state.settings.missionStart = entry.date;
    }
    upsert(entry);
    const r = evaluate();
    toast(`Saved. Overall status: ${LEVEL_LABEL[r.overall]}${r.findings.length ? ` — ${r.findings.length} item(s) in your action plan` : ''}.`);
    go('dashboard');
  }

  // ------------------------------------------------------------ TRENDS
  function renderTrends() {
    const r = evaluate();
    const m = METRICS[trendMetric], b = r.baseline.metrics[trendMetric];
    let rows = state.entries.filter(e => U.isNum(e[trendMetric]));
    if (trendRange) rows = rows.slice(-trendRange);
    const pts = rows.map(e => ({ x: U.missionDay(e.date, state.settings) ?? state.entries.indexOf(e), y: e[trendMetric], date: e.date }));
    const band = b ? { mean: b.mean, lo: b.mean - 2 * b.sd, hi: b.mean + 2 * b.sd } : null;
    const vals = rows.map(e => e[trendMetric]);
    const last7 = vals.slice(-7);
    const wk = rows.length >= 7 ? U.slope(pts.slice(-14).map(p => p.x), pts.slice(-14).map(p => p.y)) * 7 : null;

    let html = `<section class="panel"><div class="panel-head"><h2>${m.label}</h2>
      <div class="btn-row">
        <select id="trendMetric">${Object.entries(METRICS).map(([k, mm]) => `<option value="${k}" ${k === trendMetric ? 'selected' : ''}>${mm.label}</option>`).join('')}</select>
        <select id="trendRange">${[[30, 'Last 30'], [60, 'Last 60'], [120, 'Last 120'], [0, 'All']].map(([v, l]) => `<option value="${v}" ${v === trendRange ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div></div>
      <div class="chart">${lineChart(pts, { band, unit: m.unit, dec: m.dec, label: m.label })}</div>
      <div class="legend"><span><i style="background:var(--accent);opacity:.25"></i>your baseline ±2σ</span><span><i style="background:var(--watch)"></i>outside your normal range</span><span>Hover points for values</span></div>
      <div class="kv">
        <div><span>Baseline</span><b>${b ? `${b.mean.toFixed(m.dec)} ± ${b.sd.toFixed(m.dec || 1)}` : '—'}</b></div>
        <div><span>Last 7 avg</span><b>${last7.length ? U.mean(last7).toFixed(m.dec) : '—'} ${m.unit}</b></div>
        <div><span>Trend (14 d)</span><b>${wk === null ? '—' : (wk >= 0 ? '+' : '') + wk.toFixed(m.dec + 1) + ' /wk'}</b></div>
        <div><span>Readings</span><b>${vals.length}</b></div>
      </div></section>`;

    // drift scan
    html += `<section class="panel"><div class="panel-head"><h2>Drift scan</h2><span class="muted small">7-day average vs. your baseline, largest change first — click a row to chart it</span></div>`;
    if (!r.drift.length) html += `<p class="muted">Need at least 3 baseline readings per metric.</p>`;
    else {
      html += `<div class="table-wrap"><table><thead><tr><th>Indicator</th><th class="num">Baseline</th><th class="num">7-day avg</th><th class="num">Change</th><th>Deviation</th></tr></thead><tbody>`;
      for (const d of r.drift) {
        const mm = METRICS[d.key], az = Math.min(4, Math.abs(d.z));
        const col = az >= 2 ? 'var(--watch)' : az >= 1 ? 'var(--accent)' : 'var(--muted)';
        html += `<tr class="clickable" data-metric="${d.key}"><td>${mm.label}</td><td class="num">${d.baseline.toFixed(mm.dec)}</td><td class="num">${d.recent.toFixed(mm.dec)}</td>
          <td class="num">${d.recent - d.baseline >= 0 ? '+' : ''}${(d.recent - d.baseline).toFixed(mm.dec)} ${mm.unit}</td>
          <td><span class="zbar" style="width:${(az * 25).toFixed(0)}px;background:${col}"></span> <span class="small muted">${d.z >= 0 ? '+' : ''}${d.z.toFixed(1)}σ</span></td></tr>`;
      }
      html += `</tbody></table></div>`;
    }
    html += `</section>`;
    return html;
  }

  // ------------------------------------------------------------ PVT (psychomotor vigilance test)
  const pvt = { running: false, rts: [], falseStarts: 0, timer: null, raf: null, shownAt: 0, endAt: 0, duration: 180, result: null };

  function renderPvt() {
    const res = pvt.result;
    return `<section class="panel"><div class="panel-head"><div><h2>Alertness test (PVT)</h2>
      <div class="muted small">A psychomotor vigilance test — the standard spaceflight measure of fatigue-related attention loss. When the yellow counter appears, tap the box or press <b>Space</b> as fast as you can. Responses over 500 ms count as lapses.</div></div>
      <div class="btn-row"><select id="pvtDuration">${[[60, '1 min (quick)'], [180, '3 min (standard)'], [300, '5 min']].map(([v, l]) => `<option value="${v}" ${v === pvt.duration ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn primary" data-action="pvt-start">${pvt.running ? 'Restart' : 'Start test'}</button></div></div>
      <div class="pvt-area" id="pvtArea"><div id="pvtMsg">${pvt.running ? 'Wait for the counter…' : 'Press Start, then focus here.'}</div><div class="counter" id="pvtCounter" hidden>0</div><div class="muted small" id="pvtProg"></div></div>
      ${res ? `<div class="pvt-stats kv">
        <div><span>Median RT</span><b>${res.median} ms</b></div><div><span>Lapses (&gt;500 ms)</span><b>${res.lapses}</b></div>
        <div><span>Fastest 10%</span><b>${res.fast} ms</b></div><div><span>False starts</span><b>${res.falseStarts}</b></div><div><span>Responses</span><b>${res.n}</b></div></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn primary" data-action="pvt-save">Save to today's check-in</button></div>` : ''}
    </section>`;
  }

  function pvtStart() {
    pvtStop();
    pvt.duration = Number($('#pvtDuration').value);
    Object.assign(pvt, { running: true, rts: [], falseStarts: 0, shownAt: 0, result: null, endAt: performance.now() + pvt.duration * 1000 });
    render();
    $('#pvtArea').focus();
    pvtSchedule();
  }
  function pvtSchedule() {
    const isi = 2000 + Math.random() * 8000;   // 2–10 s random inter-stimulus interval
    if (performance.now() + isi > pvt.endAt) { pvt.timer = setTimeout(pvtFinish, Math.max(0, pvt.endAt - performance.now())); return; }
    pvt.timer = setTimeout(() => {
      pvt.shownAt = performance.now();
      const c = $('#pvtCounter'); if (!c) return pvtStop();
      c.hidden = false; $('#pvtMsg').hidden = true;
      const tick = () => { if (!pvt.shownAt) return; c.textContent = Math.round(performance.now() - pvt.shownAt); pvt.raf = requestAnimationFrame(tick); };
      tick();
      // auto-timeout after 30 s without a response
      pvt.timer = setTimeout(() => pvtRespond(), 30000);
    }, isi);
    const left = Math.max(0, Math.round((pvt.endAt - performance.now()) / 1000));
    const p = $('#pvtProg'); if (p) p.textContent = `${pvt.rts.length} responses · ${left}s left`;
  }
  function pvtRespond() {
    if (!pvt.running) return;
    const area = $('#pvtArea');
    if (!pvt.shownAt) {
      pvt.falseStarts++;
      if (area) { area.classList.add('false-start'); setTimeout(() => area.classList.remove('false-start'), 250); }
      return;
    }
    const rt = performance.now() - pvt.shownAt;
    pvt.shownAt = 0; cancelAnimationFrame(pvt.raf); clearTimeout(pvt.timer);
    pvt.rts.push(rt);
    const c = $('#pvtCounter'); if (c) c.textContent = Math.round(rt);
    setTimeout(() => { const c2 = $('#pvtCounter'); if (c2 && !pvt.shownAt) { c2.hidden = true; $('#pvtMsg').hidden = false; $('#pvtMsg').textContent = 'Wait for the counter…'; } }, 500);
    pvtSchedule();
  }
  function pvtFinish() {
    const rts = pvt.rts, n = rts.length;
    pvtStop();
    if (n < 3) { toast('Too few responses to score — try a longer test.'); render(); return; }
    const sorted = [...rts].sort((a, b) => a - b);
    pvt.result = {
      n, median: Math.round(U.median(rts)), lapses: rts.filter(r => r > 500).length,
      fast: Math.round(U.mean(sorted.slice(0, Math.max(1, Math.round(n * 0.1))))), falseStarts: pvt.falseStarts,
    };
    render();
  }
  function pvtStop() { pvt.running = false; pvt.shownAt = 0; clearTimeout(pvt.timer); cancelAnimationFrame(pvt.raf); }
  function pvtSave() {
    const date = U.todayStr();
    const e = Object.assign({ date, symptoms: [] }, entryFor(date) || {});
    e.pvt = pvt.result.median; e.lapses = pvt.result.lapses;
    upsert(e);
    pvt.result = null;
    checkinDate = date;
    toast('Alertness result saved to today\'s check-in.');
    go('checkin');
  }

  // ------------------------------------------------------------ DATA
  function renderData() {
    const rows = [...state.entries].reverse();
    let html = `<section class="panel"><div class="panel-head"><h2>Check-in log</h2>
      <div class="btn-row">
        <button class="btn" data-action="export-json">Export JSON</button><button class="btn" data-action="export-csv">Export CSV</button>
        <label class="btn">Import JSON<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        <button class="btn" data-action="demo">Load demo</button><button class="btn danger" data-action="clear">Clear all</button>
      </div></div>
      <p class="muted small">${state.entries.length} entries stored locally on this device. Click a row to edit it.</p>`;
    if (rows.length) {
      html += `<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Day</th><th class="num">HR</th><th class="num">BP</th><th class="num">SpO₂</th><th class="num">Temp</th><th class="num">Mass</th><th class="num">Sleep</th><th class="num">Resist.</th><th class="num">Mood</th><th class="num">RT</th><th class="num">Dose</th><th>Symptoms</th></tr></thead><tbody>`;
      for (const e of rows) {
        html += `<tr class="clickable" data-edit="${e.date}"><td>${e.date}</td><td class="num">${U.missionDay(e.date, state.settings) ?? ''}</td>
          <td class="num">${U.fmt('hr', e.hr)}</td><td class="num">${U.isNum(e.sbp) ? `${e.sbp}/${e.dbp ?? '—'}` : '—'}</td><td class="num">${U.fmt('spo2', e.spo2)}</td>
          <td class="num">${U.fmt('temp', e.temp)}</td><td class="num">${U.fmt('weight', e.weight)}</td><td class="num">${U.fmt('sleep', e.sleep)}</td>
          <td class="num">${U.fmt('resistance', e.resistance)}</td><td class="num">${U.fmt('mood', e.mood)}</td><td class="num">${U.fmt('pvt', e.pvt)}</td><td class="num">${U.fmt('dose', e.dose)}</td>
          <td class="small muted">${(e.symptoms || []).length || ''}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }
    return html + `</section>`;
  }

  function toCsv() {
    const keys = ['date', 'missionDay', ...Object.keys(METRICS), 'symptoms', 'notes'];
    const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [keys.join(','), ...state.entries.map(e => keys.map(k =>
      k === 'missionDay' ? q(U.missionDay(e.date, state.settings)) : k === 'symptoms' ? q((e.symptoms || []).join(';')) : q(e[k])).join(','))].join('\n');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.entries)) throw new Error('missing entries array');
        const clean = data.entries.filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map(e => {
          const out = { date: e.date, symptoms: Array.isArray(e.symptoms) ? e.symptoms.filter(s => typeof s === 'string') : [] };
          for (const k of Object.keys(METRICS)) if (U.isNum(e[k])) out[k] = e[k];
          if (typeof e.notes === 'string') out.notes = e.notes;
          return out;
        });
        state = { settings: Object.assign({}, E.DEFAULT_SETTINGS, data.settings || {}), entries: U.sortEntries(clean) };
        save(); toast(`Imported ${clean.length} entries.`); go('dashboard');
      } catch (err) { toast('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------ SETTINGS
  function renderSettings() {
    const s = state.settings;
    const f = (name, label, type, extra = '', hint = '') => `<div class="field"><label for="s-${name}">${label}</label><input type="${type}" id="s-${name}" name="${name}" value="${esc(s[name] ?? '')}" ${extra}>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    return `<form class="panel" id="settingsForm"><div class="panel-head"><h2>Mission &amp; personal settings</h2></div>
      <div class="form-section"><h2>Mission</h2><div class="form-grid">
        ${f('crewName', 'Crew member name', 'text')}
        ${f('missionStart', 'Launch date (mission day 1)', 'date', '', 'Check-ins before this date form your baseline')}
        ${f('missionLength', 'Planned mission length (days)', 'number', 'min="1" max="1500"')}</div></div>
      <div class="form-section"><h2>Radiation</h2><div class="form-grid">
        ${f('priorCareerDose', 'Prior career dose (mSv)', 'number', 'min="0" step="0.1"')}
        ${f('careerLimit', 'Career limit (mSv)', 'number', 'min="1" step="1"', 'NASA-STD-3001: 600 mSv effective dose')}</div></div>
      <div class="form-section"><h2>Daily countermeasure targets</h2><div class="form-grid">
        ${f('resistanceTarget', 'Resistance exercise (min)', 'number', 'min="0"')}
        ${f('aerobicTarget', 'Aerobic exercise (min)', 'number', 'min="0"')}
        ${f('fluidTarget', 'Fluid intake (L)', 'number', 'min="0" step="0.1"')}</div></div>
      <div class="btn-row" style="margin-top:16px"><button class="btn primary" type="submit">Save settings</button></div></form>`;
  }
  function saveSettings(form) {
    const fd = new FormData(form), s = state.settings;
    s.crewName = (fd.get('crewName') || '').trim() || 'Crew member';
    s.missionStart = fd.get('missionStart') || null;
    for (const k of ['missionLength', 'priorCareerDose', 'careerLimit', 'resistanceTarget', 'aerobicTarget', 'fluidTarget']) {
      const v = Number(fd.get(k)); if (isFinite(v) && fd.get(k) !== '') s[k] = v;
    }
    save(); toast('Settings saved.'); render();
  }

  // ------------------------------------------------------------ routing
  const VIEWS = { dashboard: renderDashboard, checkin: renderCheckin, trends: renderTrends, pvt: renderPvt, data: renderData, settings: renderSettings };
  function go(tab) {
    if (tab !== 'pvt' && pvt.running) pvtStop();
    currentTab = tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    render();
    window.scrollTo({ top: 0 });
  }
  function render() {
    renderHeader();
    $('#view').innerHTML = VIEWS[currentTab]();
    if (currentTab === 'pvt') $('#pvtArea').tabIndex = 0;
  }

  // ------------------------------------------------------------ events
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-tab],[data-go],[data-action],[data-domain],[data-metric],[data-edit],[data-close]');
    if (ev.target.id === 'modal') return closeModal();
    if (ev.target.closest('#pvtArea') && pvt.running) { ev.preventDefault(); return pvtRespond(); }
    if (!t) return;
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.go) { if (t.dataset.go === 'checkin') checkinDate = U.todayStr(); return go(t.dataset.go); }
    if (t.dataset.close !== undefined) return closeModal();
    if (t.dataset.domain) return showDomain(t.dataset.domain);
    if (t.dataset.metric) { trendMetric = t.dataset.metric; return go('trends'); }
    if (t.dataset.edit) { checkinDate = t.dataset.edit; return go('checkin'); }
    switch (t.dataset.action) {
      case 'demo':
        if (state.entries.length && !confirm('Replace your current data with the demo mission?')) return;
        state = E.generateDemo(U.todayStr()); save(); toast('Demo mission loaded: 14 preflight + 124 flight days.'); return go('dashboard');
      case 'report': return showReport();
      case 'copy-report': {
        const ta = $('.report'); ta.select();
        (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Report copied.'), () => { document.execCommand('copy'); toast('Report copied.'); });
        return;
      }
      case 'dl-report': return download(`astrovital-report-${U.todayStr()}.txt`, $('.report').value, 'text/plain');
      case 'export-json': return download(`astrovital-${U.todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
      case 'export-csv': return download(`astrovital-${U.todayStr()}.csv`, toCsv(), 'text/csv');
      case 'clear':
        if (!confirm('Delete ALL check-ins and settings on this device? Export first if you need them.')) return;
        state = { settings: Object.assign({}, E.DEFAULT_SETTINGS), entries: [] }; save(); return go('dashboard');
      case 'delete-entry':
        if (!confirm(`Delete the check-in for ${checkinDate}?`)) return;
        state.entries = state.entries.filter(e => e.date !== checkinDate); save(); toast('Entry deleted.'); return go('data');
      case 'pvt-start': return pvtStart();
      case 'pvt-save': return pvtSave();
    }
  });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    if (ev.target.id === 'checkinForm') saveCheckin(ev.target);
    if (ev.target.id === 'settingsForm') saveSettings(ev.target);
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'trendMetric') { trendMetric = t.value; render(); }
    if (t.id === 'trendRange') { trendRange = Number(t.value); render(); }
    if (t.id === 'importFile' && t.files[0]) importJson(t.files[0]);
    if (t.id === 'f-date') { checkinDate = t.value || U.todayStr(); render(); }
    if (t.id === 'pvtDuration') pvt.duration = Number(t.value);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !$('#modal').hidden) return closeModal();
    if (currentTab === 'pvt' && pvt.running && (ev.code === 'Space' || ev.key === ' ')) { ev.preventDefault(); if (!ev.repeat) pvtRespond(); }
  });

  render();
})();
