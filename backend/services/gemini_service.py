import json
import re
from typing import List
from groq import Groq
from core.config import settings
from models.schemas import RecruiterFeedback, RewrittenBullet

ROLE_CONTEXT = {
    "sde": "Software Development Engineer (SDE) role focusing on system design, coding, and software architecture",
    "ml": "Machine Learning Engineer role focusing on ML systems, model development, and data pipelines",
    "analyst": "Data/Business Analyst role focusing on data analysis, insights, and business intelligence",
    "general": "general professional role",
}

# Each persona evaluates the SAME resume through a different hiring lens.
PERSONA_CONTEXT = {
    "standard": {
        "title": "Senior Recruiter",
        "lens": (
            "You evaluate resumes in a balanced, general-purpose way. Weigh relevance, "
            "measurable impact, technical depth, and clarity roughly equally."
        ),
        "values": "overall relevance, measurable achievements, clear structure",
        "tone": "professional and balanced",
    },
    "faang": {
        "title": "FAANG / Big Tech Technical Recruiter",
        "lens": (
            "You hire for large-scale tech companies (Google, Meta, Amazon, etc.). You care most "
            "about scale, algorithmic and system-design depth, quantified impact at scale, strong "
            "engineering fundamentals, and signals of working on high-traffic / high-complexity systems. "
            "You are demanding and score conservatively — a 7+ means truly strong."
        ),
        "values": "scale, system design, algorithmic depth, quantified impact, top-tier signals",
        "tone": "rigorous, high-bar, detail-oriented",
    },
    "startup": {
        "title": "Early-Stage Startup Recruiter / Founder",
        "lens": (
            "You hire for a fast-moving startup. You care most about ownership, versatility, "
            "shipping speed, end-to-end delivery, scrappiness, and the ability to wear many hats. "
            "You value builders who ship real products over pure pedigree. You reward initiative "
            "and breadth, and you are wary of candidates who only operated inside rigid processes."
        ),
        "values": "ownership, versatility, shipping speed, end-to-end impact, initiative",
        "tone": "energetic, pragmatic, builder-focused",
    },
    "hr": {
        "title": "HR / People & Culture Recruiter",
        "lens": (
            "You screen for culture fit, communication, professionalism, and overall presentation. "
            "You care most about clarity, soft skills, consistency, career progression, red-flag-free "
            "history, and how well the resume reads to a non-technical reviewer. You are less focused "
            "on deep technical nuance and more on coherence, readability, and human signals."
        ),
        "values": "communication, clarity, culture fit, professionalism, career progression",
        "tone": "warm, people-focused, presentation-aware",
    },
}

MODEL = "llama-3.3-70b-versatile"


def get_client() -> Groq:
    return Groq(api_key=settings.GROQ_API_KEY)


def _extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response."""
    text = re.sub(r"```(?:json)?", "", text).strip("` \n")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Could not parse JSON from response: {text[:200]}")


async def simulate_recruiter(
    resume_text: str,
    jd_text: str,
    role_type: str = "general",
    persona: str = "standard",
) -> RecruiterFeedback:
    """Use Groq to simulate a recruiter evaluating the resume through a chosen persona lens."""
    role_desc = ROLE_CONTEXT.get(role_type, ROLE_CONTEXT["general"])
    p = PERSONA_CONTEXT.get(persona, PERSONA_CONTEXT["standard"])

    prompt = f"""You are a {p['title']} with 10+ years of experience hiring for {role_desc}.

## YOUR EVALUATION LENS:
{p['lens']}
You especially value: {p['values']}.
Adopt a {p['tone']} tone in your feedback.

Evaluate the following resume against the job description STRICTLY through this lens.
Two different recruiters should reach different conclusions on the same resume — make your
persona's priorities clearly visible in the score, strengths, weaknesses, and suggestions.

## JOB DESCRIPTION:
{jd_text[:3000]}

## RESUME:
{resume_text[:3000]}

Evaluate based on:
1. Relevance to the job description
2. Impact and measurability of achievements
3. Technical depth and skill alignment
4. Clarity, structure, and professionalism
...all weighted according to YOUR persona's priorities above.

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, just raw JSON:
{{
  "score": <number between 0 and 10>,
  "strengths": [<3-5 specific strength strings>],
  "weaknesses": [<3-5 specific weakness strings>],
  "suggestions": [<4-6 concrete, actionable improvement suggestions>]
}}"""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or ""
        print(f"✅ Groq recruiter response received (persona={persona})")
        data = _extract_json(raw)

        return RecruiterFeedback(
            score=float(data.get("score", 5.0)),
            strengths=data.get("strengths", [])[:6],
            weaknesses=data.get("weaknesses", [])[:6],
            suggestions=data.get("suggestions", [])[:6],
            persona=persona,
        )
    except Exception as e:
        print(f"❌ Groq recruiter simulation failed: {type(e).__name__}: {e}")
        return RecruiterFeedback(
            score=5.0,
            strengths=["Resume submitted for review"],
            weaknesses=["Could not fully analyze — please try again"],
            suggestions=["Ensure your resume clearly lists measurable achievements"],
            persona=persona,
        )


async def rewrite_bullet_points(
    bullets: List[str],
    job_context: str = "",
) -> List[RewrittenBullet]:
    """Rewrite weak bullet points to be more impactful using Groq."""
    if not bullets:
        return []

    results: List[RewrittenBullet] = []
    batch_size = 5

    for i in range(0, len(bullets), batch_size):
        batch = bullets[i:i + batch_size]
        batch_results = await _rewrite_batch(batch, job_context)
        results.extend(batch_results)

    return results


async def _rewrite_batch(
    bullets: List[str],
    job_context: str = "",
) -> List[RewrittenBullet]:
    """Rewrite a batch of bullet points."""
    numbered = "\n".join(f"{j+1}. {b}" for j, b in enumerate(bullets))
    context_note = f"\nTarget role context: {job_context}" if job_context else ""

    prompt = f"""You are an expert resume writer and career coach.{context_note}

Rewrite each bullet point below to be more impactful. Use:
- Strong action verbs (Led, Built, Optimized, Delivered, Reduced, Increased, etc.)
- Specific numbers and measurable outcomes where possible
- Concise, results-focused language
- Active voice

Here are the bullet points to rewrite:
{numbered}

Respond ONLY with valid JSON — no markdown, no explanation:
{{
  "rewrites": [
    {{"original": "<original bullet 1>", "improved": "<improved bullet 1>"}},
    {{"original": "<original bullet 2>", "improved": "<improved bullet 2>"}}
  ]
}}"""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or ""
        data = _extract_json(raw)
        rewrites = data.get("rewrites", [])

        result = []
        for j, bullet in enumerate(bullets):
            improved = rewrites[j].get("improved", bullet) if j < len(rewrites) else bullet
            result.append(RewrittenBullet(original=bullet, improved=improved))

        return result
    except Exception as e:
        print(f"❌ Groq rewrite failed: {type(e).__name__}: {e}")
        return [RewrittenBullet(original=b, improved=b) for b in bullets]