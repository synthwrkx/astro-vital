"""Mission profiles built on published space-science measurements.

Each profile sets the environment the crew member lives in: the expected radiation dose rate
(from instrument data), the communication delay to Earth (how long a self-managed crew waits
for help), and gravity. Earth-analog profiles carry the same isolation and delayed support
without the space environment, so the tool also serves remote workers on Earth.

Values are representative published figures for a hackathon prototype. Check them against the
cited sources before operational use.
"""
from __future__ import annotations

from typing import Any

PROFILES: dict[str, dict[str, Any]] = {
    "iss": {
        "name": "ISS — low Earth orbit",
        "kind": "space",
        "dose_msv_day": 0.6,
        "dose_note": "Typical ISS crew dose is about 0.5–0.9 mSv/day; the station sits inside Earth's magnetosphere.",
        "dose_source": "NASA Space Radiation Analysis Group, ISS crew dosimetry",
        "delay": "< 1 s (with periodic loss-of-signal)",
        "delay_s": 1,
        "gravity_g": 0.0,
        "support": "Near-real-time flight surgeon support; return to Earth possible within hours.",
    },
    "lunar_surface": {
        "name": "Lunar surface (Artemis)",
        "kind": "space",
        "dose_msv_day": 1.37,
        "dose_note": "First lunar-surface dose measurement: 1.37 mSv/day (dose equivalent).",
        "dose_source": "Chang'e-4 Lunar Lander Neutrons & Dosimetry (LND); Zhang et al., Science Advances 2020",
        "delay": "≈ 1.3 s each way",
        "delay_s": 1.3,
        "gravity_g": 0.166,
        "support": "Ground support available, but return to Earth takes days.",
    },
    "mars_transit": {
        "name": "Mars transit (deep space)",
        "kind": "space",
        "dose_msv_day": 1.84,
        "dose_note": "Measured inside the Curiosity spacecraft during its 253-day cruise: 1.84 mSv/day.",
        "dose_source": "MSL Radiation Assessment Detector (RAD); Zeitlin et al., Science 2013",
        "delay": "up to 20 min each way",
        "delay_s": 20 * 60,
        "gravity_g": 0.0,
        "support": "Mars is on average 140 million miles away (NASA). No evacuation is possible, a reply from Earth can take up to 40 minutes, and solar conjunction blacks out the link for about 2 weeks.",
    },
    "mars_surface": {
        "name": "Mars surface",
        "kind": "space",
        "dose_msv_day": 0.64,
        "dose_note": "Measured on the surface at Gale crater: 0.64 mSv/day (the atmosphere and planet shield about half the sky).",
        "dose_source": "MSL Radiation Assessment Detector (RAD); Hassler et al., Science 2014",
        "delay": "up to 20 min each way",
        "delay_s": 20 * 60,
        "gravity_g": 0.38,
        "support": "Crew must self-manage health for months; Earth gives advice only after a long delay.",
    },
    "lunar_rover": {
        "name": "Pressurized lunar rover (excursion)",
        "kind": "space",
        "dose_msv_day": 1.37,
        "dose_note": "Lunar-surface dose (1.37 mSv/day) as the reference; a rover offers less shielding than a base habitat.",
        "dose_source": "Chang'e-4 Lunar Lander Neutrons & Dosimetry (LND); Zhang et al., Science Advances 2020",
        "delay": "≈ 1.3 s each way",
        "delay_s": 1.3,
        "gravity_g": 0.166,
        "support": "Days of driving away from the base habitat, with a limited medical kit and a small, confined cabin.",
    },
    "antarctic": {
        "name": "Antarctic winter-over station (Earth analog)",
        "kind": "earth_analog",
        "dose_msv_day": 0.0,
        "dose_note": "Natural background only; radiation monitoring isn't the focus.",
        "dose_source": "—",
        "delay": "Satellite link, intermittent",
        "delay_s": 0,
        "gravity_g": 1.0,
        "support": "No evacuation for months in winter; ESA and NASA use these stations as analogs for long-duration isolation.",
    },
    "remote_earth": {
        "name": "Remote Earth worksite (offshore, polar, rural)",
        "kind": "earth_analog",
        "dose_msv_day": 0.0,
        "dose_note": "Natural background only.",
        "dose_source": "—",
        "delay": "Limited connectivity",
        "delay_s": 0,
        "gravity_g": 1.0,
        "support": "Isolated crews and remote communities far from clinics can self-monitor the same way.",
    },
}

DEFAULT_PROFILE = "iss"


def profile(key: str | None) -> dict[str, Any]:
    return PROFILES.get(key or DEFAULT_PROFILE, PROFILES[DEFAULT_PROFILE])
