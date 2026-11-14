"""Rule registry. Order matters only where a rule reads earlier findings (catch-all runs last)."""
from .base import HealthRule
from .behavior import AlertnessRule, CrewConflictRule, MoodRule, SleepRule, StressRule
from .bone import BodyMassRule, ExerciseComplianceRule, HydrationRule
from .cardio import BloodPressureRule, HeartRateRule
from .environment import HeadacheRule, OxygenRule, VisionRule
from .immune import InfectionSymptomsRule, TemperatureRule
from .nutrition import GlucoseRule, IntakeRule
from .radiation import RadiationRule, radiation_summary
from .symptoms import SymptomCatchAllRule


def default_rules() -> list[HealthRule]:
    return [
        HeartRateRule(), BloodPressureRule(),
        ExerciseComplianceRule(), BodyMassRule(), HydrationRule(),
        GlucoseRule(), IntakeRule(),
        TemperatureRule(), InfectionSymptomsRule(),
        SleepRule(), MoodRule(), StressRule(), CrewConflictRule(), AlertnessRule(),
        RadiationRule(),
        OxygenRule(), HeadacheRule(), VisionRule(),
        SymptomCatchAllRule(),
    ]


__all__ = ["HealthRule", "default_rules", "radiation_summary"]
