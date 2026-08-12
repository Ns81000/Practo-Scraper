SPECIALTY_SLUG_MAP = {
    "homeopathy-doctor": "homoeopath",
    "homeopathy": "homoeopath",
    "ayurvedic-doctor": "ayurveda",
    "ayurvedic": "ayurveda",
    "ayurveda-doctor": "ayurveda",
    "ent-specialist": "ent-doctor",
    "ent": "ent-doctor",
    "ivf-specialist": "ivf-and-infertility-specialist",
    "ivf": "ivf-and-infertility-specialist",
    "skin-specialist": "dermatologist",
    "skin-doctor": "dermatologist",
    "eye-specialist": "ophthalmologist",
    "eye-doctor": "ophthalmologist",
    "heart-specialist": "cardiologist",
    "heart-doctor": "cardiologist",
    "bone-specialist": "orthopedist",
    "bone-doctor": "orthopedist",
    "child-specialist": "pediatrician",
    "children-doctor": "pediatrician",
    "brain-specialist": "neurologist",
    "nerve-doctor": "neurologist",
    "kidney-specialist": "nephrologist",
    "kidney-doctor": "nephrologist",
    "cancer-specialist": "oncologist",
    "cancer-doctor": "oncologist",
    "stomach-specialist": "gastroenterologist",
    "stomach-doctor": "gastroenterologist",
    "lung-specialist": "pulmonologist",
    "lung-doctor": "pulmonologist",
    "diabetes-specialist": "diabetologist",
    "diabetes-doctor": "diabetologist",
    "physiotherapist": "physiotherapist",
    "physio": "physiotherapist",
    "psychologist": "psychologist",
    "psychiatrist": "psychiatrist",
    "sexologist": "sexologist",
    "urologist": "urologist",
}


def resolve_specialty_slug(
    raw_specialty: str, autocomplete_slug: str | None = None
) -> str:
    """Resolve specialty to Practo URL slug.

    Priority:
    1. Autocomplete slug from Practo API (most reliable)
    2. Hardcoded mapping for known mismatches
    3. Naive slug derivation (spaces → hyphens, lowercase)
    """
    if autocomplete_slug:
        return autocomplete_slug.strip().lower()

    naive_slug = raw_specialty.strip().replace(" ", "-").lower()

    if naive_slug in SPECIALTY_SLUG_MAP:
        return SPECIALTY_SLUG_MAP[naive_slug]

    return naive_slug


def resolve_location_slug(
    raw_location: str, autocomplete_slug: str | None = None
) -> str:
    """Resolve location to Practo URL slug."""
    if autocomplete_slug:
        return autocomplete_slug.strip().lower()

    return raw_location.strip().replace(" ", "-").lower()
