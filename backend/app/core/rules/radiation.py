from __future__ import annotations

from typing import Optional

from ..context import EvaluationContext
from ..models import Finding
from ..stats import is_num, median, values
from ..profiles import profile
from .base import HealthRule


def radiation_summary(ctx: EvaluationContext) -> Optional[dict]:
    """Mission/career dose, average rate and end-of-mission projection."""
    doses = values(ctx.flight_entries, "dose")
    if not doses:
        return None
    s = ctx.settings
    mission_dose = sum(doses)
    career = s["prior_career_dose"] + mission_dose
    rate = mission_dose / max(1, ctx.mission_day or len(doses))
    return dict(mission_dose=mission_dose, career=career, rate=rate,
                projected=s["prior_career_dose"] + rate * s["mission_length"],
                pct=career / s["career_limit"] * 100, limit=s["career_limit"], prior=s["prior_career_dose"],
                typical_daily=median(doses), expected_rate=profile(s.get("mission_profile"))["dose_msv_day"])


class RadiationRule(HealthRule):
    domain = "radiation"
    evidence = ("NASA risk: Radiation Carcinogenesis; NASA calls radiation \"one of the most hazardous aspects of human spaceflight\". CSA: neutrons are about 30% of ISS dose, measured with bubble detectors and the CANS spectrometer. NASA-STD-3001 sets a 600 mSv career effective-dose limit. Solar "
                "particle events can deliver large doses within hours, and the counter-measure is shelter.")

    def evaluate(self, ctx: EvaluationContext) -> list[Finding]:
        r = radiation_summary(ctx)
        if not r:
            return []
        out: list[Finding] = []
        typical, today = r["typical_daily"], ctx.latest.get("dose")
        spike = is_num(today) and typical > 0 and today >= max(3 * typical, typical + 1)
        if spike:
            out.append(self.finding("act", "Radiation dose spike — possible solar particle event",
                f"{today:.2f} mSv today vs typical {typical:.2f} mSv/day.",
                ["Move to the designated storm shelter / most shielded module now",
                 "Confirm space-weather alert with ground", "Keep personal dosimeter on; log time in shelter"], True))
        elif is_num(today) and typical > 0 and today >= 1.8 * typical:
            out.append(self.finding("watch", "Radiation dose above typical",
                f"{today:.2f} mSv today vs typical {typical:.2f} mSv/day.",
                ["Check space-weather status", "Minimise time in lightly-shielded areas"]))
        career, limit, pct = r["career"], r["limit"], r["pct"]
        if pct >= 95:
            out.append(self.finding("act", "Approaching career dose limit", f"{career:.0f} of {limit:.0f} mSv ({pct:.0f}%).",
                                    ["Review remaining mission timeline with ground", "Maximise time in shielded areas"], True))
        elif pct >= 80:
            out.append(self.finding("watch", "High share of career dose used", f"{career:.0f} of {limit:.0f} mSv ({pct:.0f}%).",
                                    ["Prefer sleeping in the most shielded quarters"]))
        elif r["projected"] > limit:
            out.append(self.finding("watch", "Projected to exceed career limit",
                f"At {r['rate']:.2f} mSv/day you'd reach ~{r['projected']:.0f} mSv by mission end (limit {limit:.0f}).",
                ["Discuss shielding and timeline options with ground"]))
        exp = r["expected_rate"]
        if exp > 0 and typical > 1.5 * exp:
            p = profile(ctx.settings.get("mission_profile"))
            out.append(self.finding("watch", "Background dose above mission profile",
                f"Typical {typical:.2f} mSv/day vs ~{exp:.2f} expected for {p['name']} ({p['dose_source']}).",
                ["Check dosimeter placement and calibration", "Review time spent in lightly-shielded modules"]))
        if "nausea" in ctx.symptoms_today and spike:
            out.append(self.finding("act", "Nausea following a dose spike", "Could indicate acute radiation effects.",
                                    ["Report immediately with dosimeter readings"], True))
        return out
