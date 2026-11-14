"""Onboard natural-language generation: template-based writers over a shared Insights object."""
from __future__ import annotations

from ...core import DOMAINS, LEVEL_LABEL, METRICS, SYMPTOM_BY_ID, Finding
from ...core.profiles import profile
from ...core.stats import is_num, mean, values
from ..base import Briefing, Priority
from .insights import Insights

URGENCY = {"act": "now", "watch": "this_week"}
FORECAST_ACTION = {
    "sleep": "Protect a full 8.5 h sleep window tonight and ask ground for timeline relief if needed.",
    "pvt": "Re-test alertness before any safety-critical task; nap ≤30 min if you can.",
    "mood": "Book a private psychological support conference and plan some leisure time.",
    "weight": "Add calories and protein (≥1.2 g/kg/day) and review food intake.",
}


def metric_line(ins: Insights, key: str) -> str:
    m, ctx = METRICS[key], ins.ctx
    v7, b = ctx.avg7(key), ctx.base(key)
    if v7 is None:
        return f"- **{m['label']}:** no recent readings"
    s = f"- **{m['label']}:** 7-day avg {v7:.{m['dec']}f} {m['unit']}"
    if b and key != "dose":  # preflight dose is ~0 on Earth, so a dose baseline is meaningless
        z = (v7 - b["mean"]) / b["sd"]
        s += f" vs baseline {b['mean']:.{m['dec']}f} ({z:+.1f}σ)"
    return s


def anomaly_note(ins: Insights) -> str:
    a = ins.anomaly_today
    if not a:
        return ""
    names = ", ".join(f"{METRICS[k]['label'].lower()} {abs(z):.1f}σ {'above' if z > 0 else 'below'} baseline"
                      for k, z in a.contributors if abs(z) >= 1)
    if a.score >= 2.5:
        return (f"Today's combined anomaly score is {a.score:.1f} (alert threshold 2.5), driven by {names}. "
                "Several signals are off together, which is worth attention even where no single reading is alarming.")
    if a.score >= 1.8 and names:
        return f"Today's combined anomaly score is {a.score:.1f}, slightly elevated ({names})."
    return ""


class BriefingWriter:
    def write(self, ins: Insights) -> Briefing:
        ev = ins.ev
        acts = [f for f in ev.findings if f.level == "act"]
        watches = [f for f in ev.findings if f.level == "watch"]
        if ev.overall == "ok":
            headline = "All indicators are within your personal baseline. Keep up your countermeasures."
        elif acts:
            headline = f"{acts[0].title}: needs your attention today" + (f", plus {len(ev.findings) - 1} other item(s)." if len(ev.findings) > 1 else ".")
        else:
            headline = f"Mostly steady. {len(watches)} slow change(s) to keep an eye on, led by {watches[0].title.lower()}."

        parts = [f"Mission day {ev.mission_day}: overall status **{LEVEL_LABEL[ev.overall]}**."]
        flagged = [DOMAINS[k]["name"] for k, d in ev.domains.items() if d["level"] != "ok"]
        if flagged:
            parts.append(f"Areas flagged: {', '.join(flagged)}.")
        parts += ins.links[:2]
        if ins.forecasts:
            parts.append(ins.forecasts[0].description)
        summary = " ".join(parts)

        priorities = [Priority(title=f.title, why=f.detail, action=f.actions[0], urgency=URGENCY[f.level]) for f in ev.findings[:3]]
        if ins.forecasts and len(priorities) < 4:
            f = ins.forecasts[0]
            priorities.append(Priority(title=f"Get ahead of the {METRICS[f.metric]['label'].lower()} trend", why=f.description,
                                       action=FORECAST_ACTION.get(f.metric, "Act on the related item above before it crosses the threshold."),
                                       urgency="today" if f.days <= 7 else "this_week"))

        going_well = [f"{DOMAINS[k]['name']}: within baseline" for k, d in ev.domains.items() if d["level"] == "ok"][:3]
        esc = [f for f in ev.findings if f.escalate]
        return Briefing(
            headline=headline, summary=summary, priorities=priorities, going_well=going_well,
            contact_flight_surgeon=bool(esc),
            contact_reason=("Flagged for review: " + "; ".join(f.title for f in esc[:3]) + ".") if esc else "",
            forecasts=[f.description for f in ins.forecasts],
            anomaly_note=anomaly_note(ins),
        )


class SurgeonReportWriter:
    """Clinical downlink summary in Markdown for the ground flight surgeon."""

    def write(self, ins: Insights, settings: dict) -> str:
        ev, ctx = ins.ev, ins.ctx
        L = ["## Summary",
             f"**{settings.get('crew_name')}** · mission day {ev.mission_day} of {settings.get('mission_length')} · "
             f"engine status **{LEVEL_LABEL[ev.overall]}** · {len(ev.findings)} active finding(s), "
             f"{sum(f.escalate for f in ev.findings)} flagged for surgeon review.",
             f"Environment: {profile(settings.get('mission_profile'))['name']} · Earth link {profile(settings.get('mission_profile'))['delay']} · "
             f"{profile(settings.get('mission_profile'))['gravity_g']} g.", ""]
        if note := anomaly_note(ins):
            L += [note, ""]
        L += ["## Active findings", "| Domain | Finding | Data | Level |", "|---|---|---|---|"]
        L += [f"| {DOMAINS[f.domain]['name']} | {f.title}{' ⚑' if f.escalate else ''} | {f.detail} | {LEVEL_LABEL[f.level]} |"
              for f in ev.findings] or ["| — | None | All indicators within personal baseline | Nominal |"]
        L += ["", "## Trends of note (7-day mean vs. personal baseline)"]
        L += [f"- {METRICS[d['key']]['label']}: {d['recent']:.{METRICS[d['key']]['dec']}f} vs {d['baseline']:.{METRICS[d['key']]['dec']}f} "
              f"{METRICS[d['key']]['unit']} ({d['z']:+.1f}σ)" for d in ev.drift if abs(d["z"]) >= 1.5][:6] or ["- No metric beyond ±1.5σ."]
        if ins.forecasts:
            L += ["", "**Forecasts:**"] + [f"- {f.description}" for f in ins.forecasts]
        if ins.links:
            L += ["", "**Associations:**"] + [f"- {s}" for s in ins.links]
        s = ctx.settings
        L += ["", "## Countermeasure compliance (7-day)"]
        for k, tgt in (("resistance", s["resistance_target"]), ("aerobic", s["aerobic_target"]), ("fluid", s["fluid_target"])):
            v = ctx.avg7(k)
            L.append(f"- {METRICS[k]['label']}: {v:.1f} {METRICS[k]['unit']}/day vs target {tgt} ({v / tgt:.0%})" if v is not None and tgt else f"- {METRICS[k]['label']}: —")
        sl = ctx.avg7("sleep")
        L.append(f"- Sleep: {sl:.1f} h/night" if sl is not None else "- Sleep: —")
        L += ["", "## Radiation"]
        if r := ev.radiation:
            L.append(f"Mission {r['mission_dose']:.1f} mSv · career {r['career']:.0f}/{r['limit']:.0f} mSv ({r['pct']:.0f}%) · "
                     f"rate {r['rate']:.2f} mSv/d · projected end-of-mission {r['projected']:.0f} mSv.")
            p = profile(settings.get("mission_profile"))
            if p["dose_msv_day"]:
                L.append(f"Reference for this environment: {p['dose_msv_day']} mSv/day ({p['dose_source']}).")
            spikes = [e for e in ctx.flight_entries if is_num(e.get("dose")) and e["dose"] >= 3 * max(0.01, mean(values(ctx.flight_entries, "dose")))]
            if spikes:
                L.append("Dose spikes: " + ", ".join(f"{e['date']} ({e['dose']:.1f} mSv)" for e in spikes[:5]) + ".")
        else:
            L.append("No dosimetry recorded.")
        L += ["", "## Crew self-report (last 7 days)"]
        counts: dict[str, int] = {}
        for e in ctx.recent:
            for sid in e.get("symptoms") or []:
                counts[sid] = counts.get(sid, 0) + 1
        L.append("Symptoms: " + (", ".join(f"{SYMPTOM_BY_ID[k]['label']} ×{n}" for k, n in sorted(counts.items(), key=lambda kv: -kv[1])) or "none reported") + ".")
        for k in ("mood", "stress", "fatigue"):
            L.append(metric_line(ins, k))
        if ctx.latest.get("notes"):
            L.append(f"> Crew note ({ctx.latest['date']}): {ctx.latest['notes']}")
        L += ["", "## Suggested topics for the private medical conference"]
        L += [f"- {self._question(f)}" for f in ev.findings[:5]] or ["- Routine check-in; no specific concerns raised by onboard monitoring."]
        L += ["", "_Generated onboard by the AstroVital Onboard Health Model. No diagnosis implied; for physician assessment._"]
        return "\n".join(L)

    @staticmethod
    def _question(f: Finding) -> str:
        return {
            "behavior": f"{f.title}: explore workload, sleep environment and support needs.",
            "bone": f"{f.title}: review exercise schedule conflicts, nutrition and hydration.",
            "cardio": f"{f.title}: confirm measurement conditions; consider repeat readings or ECG.",
            "immune": f"{f.title}: review symptom timeline, lesion images, need for antivirals.",
            "radiation": f"{f.title}: review dosimetry and shielding posture.",
            "env": f"{f.title}: correlate with cabin CO₂/O₂ logs; consider vision exam (OCT).",
        }.get(f.domain, f.title)
