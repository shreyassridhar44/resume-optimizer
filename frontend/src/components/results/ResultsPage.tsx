import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getAnalysis } from '../../services/api'
import type { AnalysisResult } from '../../types'
import ScoreRing from '../ui/ScoreRing'
import CoverLetterCard from './CoverLetterCard'
import JDIntelligenceCard from './JDIntelligenceCard'
import SkillGapCard from './SkillGapCard'
import StrengthBreakdownCard from './StrengthBreakdownCard'
import RedFlagCard from './RedFlagCard'
import EvolutionCard from './EvolutionCard'
import SemanticMatchCard from './SemanticMatchCard'
import AutoEditorCard from './AutoEditorCard'
import { downloadAnalysisPDF } from '../../services/pdfExport'
import {
  CheckCircle2, XCircle, Lightbulb, ArrowLeft,
  TrendingUp, AlertTriangle, Sparkles, ChevronDown, ChevronUp,
  Download,
} from 'lucide-react'

const PERSONA_LABELS: Record<string, string> = {
  standard: 'Standard Recruiter',
  faang: 'FAANG Recruiter',
  startup: 'Startup Recruiter',
  hr: 'HR Recruiter',
}

function ATSBar({ score }: { score: number }) {
  const color = score >= 70 ? '#a3ff47' : score >= 45 ? '#47c8ff' : '#ff6b47'
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-ink-300 text-sm font-mono">ATS Match</span>
        <span className="font-display font-bold text-xl" style={{ color }}>
          {score.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 bg-ink-800 rounded-full overflow-hidden border border-ink-700">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <p className="text-xs text-ink-500 font-mono mt-1">
        {score >= 70 ? '✓ Good match' : score >= 45 ? '~ Moderate match' : '✗ Low match — add more keywords'}
      </p>
    </div>
  )
}

function BulletCard({ original, improved }: { original: string; improved: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-ink-700 rounded-xl overflow-hidden">
      <div className="p-4 bg-ink-800/40">
        <div className="flex items-start gap-2 mb-1">
          <XCircle size={13} className="text-coral mt-0.5 shrink-0" />
          <span className="text-xs font-mono text-ink-500 uppercase">Before</span>
        </div>
        <p className="text-ink-400 text-sm leading-relaxed">{original}</p>
      </div>
      <div className="p-4 border-t border-ink-700 bg-acid/3">
        <div className="flex items-start gap-2 mb-1">
          <CheckCircle2 size={13} className="text-acid mt-0.5 shrink-0" />
          <span className="text-xs font-mono text-acid uppercase">After</span>
        </div>
        <p className="text-white text-sm leading-relaxed">{improved}</p>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const { analysisId } = useParams<{ analysisId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const nav = useNavigate()

  const [data, setData] = useState<AnalysisResult | null>(
    (location.state as { result?: AnalysisResult })?.result ?? null
  )
  const [resumeText, setResumeText] = useState<string>(
    (location.state as { resumeText?: string })?.resumeText ?? ''
  )
  const [resumeId, setResumeId] = useState<string>(
    (location.state as { resumeId?: string })?.resumeId ?? ''
  )
  const [loading, setLoading] = useState(!data)
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const [showAllBullets, setShowAllBullets] = useState(false)

  useEffect(() => {
    if (!data && analysisId && user) {
      setLoading(true)
      getAnalysis(analysisId)
        .then((result) => {
          setData(result)
          // Fetch resume text if available
          if (result.resume_text) {
            setResumeText(result.resume_text)
          }
          // Fetch resume_id if available
          if (result.resume_id) {
            setResumeId(result.resume_id)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [analysisId, user, data])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-acid border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-400 text-sm font-mono">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-ink-500">
        Analysis not found.
      </div>
    )
  }

  const { ats, recruiter, rewritten_bullets } = data
  const jdIntel = data.jd_intelligence
  const strength = data.strength_breakdown
  const semanticMatch = data.semantic_match
  const visibleMissing = showAllKeywords ? ats.missing_keywords : ats.missing_keywords.slice(0, 12)
  const visibleBullets = showAllBullets ? rewritten_bullets : rewritten_bullets.slice(0, 3)

  const recruiterColor = recruiter.score >= 7 ? '#a3ff47' : recruiter.score >= 4.5 ? '#47c8ff' : '#ff6b47'

  return (
    <div className="max-w-4xl mx-auto px-8 py-12 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => nav('/dashboard')}
        className="flex items-center gap-2 text-ink-500 hover:text-acid text-sm font-mono mb-8 transition-colors"
      >
        <ArrowLeft size={14} />
        New Analysis
      </button>

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-white mb-1">Your Results</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-ink-500 text-xs font-mono">
            {new Date(data.created_at).toLocaleString()}
          </p>
          {recruiter.persona && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-acid/10 border border-acid/30 text-acid">
              <Sparkles size={11} />
              {PERSONA_LABELS[recruiter.persona] ?? 'Recruiter'} lens
            </span>
          )}
        </div>
      </div>

      {/* Score overview */}
      <div className="glass rounded-2xl p-8 mb-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex flex-col md:flex-row items-center gap-10">
          <div className="flex gap-10">
            <ScoreRing score={ats.score} max={100} label="ATS Score" color="#a3ff47" size={130} />
            <ScoreRing score={recruiter.score} max={10} label="Recruiter" color={recruiterColor} size={130} />
          </div>
          <div className="flex-1 w-full">
            <ATSBar score={ats.score} />
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-ink-800 rounded-lg px-3 py-2">
                <span className="text-ink-500">Matched</span>
                <span className="text-acid font-bold ml-2">{ats.matched_keywords.length}</span>
              </div>
              <div className="bg-ink-800 rounded-lg px-3 py-2">
                <span className="text-ink-500">Missing</span>
                <span className="text-coral font-bold ml-2">{ats.missing_keywords.length}</span>
              </div>
              <div className="bg-ink-800 rounded-lg px-3 py-2">
                <span className="text-ink-500">JD Keywords</span>
                <span className="text-ink-200 font-bold ml-2">{ats.total_jd_keywords}</span>
              </div>
              <div className="bg-ink-800 rounded-lg px-3 py-2">
                <span className="text-ink-500">Density</span>
                <span className="text-ink-200 font-bold ml-2">{ats.keyword_density}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JD Intelligence */}
      {jdIntel && <JDIntelligenceCard data={jdIntel} />}

      {/* Resume Strength Breakdown */}
      {strength && <StrengthBreakdownCard data={strength} />}

      {/* Semantic Matching */}
      {semanticMatch && <SemanticMatchCard data={semanticMatch} />}

      {/* Red Flag Detector */}
      {resumeText && <RedFlagCard resumeText={resumeText} />}

      {/* Missing keywords */}
      {ats.missing_keywords.length > 0 && (
        <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-coral" />
            Missing Keywords
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {visibleMissing.map(k => (
              <span key={k} className="chip-missing">{k}</span>
            ))}
          </div>
          {ats.missing_keywords.length > 12 && (
            <button
              onClick={() => setShowAllKeywords(!showAllKeywords)}
              className="text-xs text-ink-500 hover:text-acid flex items-center gap-1 font-mono transition-colors"
            >
              {showAllKeywords ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAllKeywords ? 'Show less' : `+${ats.missing_keywords.length - 12} more`}
            </button>
          )}
        </div>
      )}

      {/* Recruiter feedback */}
      <div className="grid md:grid-cols-2 gap-4 mb-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
        {/* Strengths */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-acid" />
            Strengths
          </h2>
          <ul className="space-y-2">
            {recruiter.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-300">
                <span className="w-1.5 h-1.5 rounded-full bg-acid mt-2 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
            <XCircle size={16} className="text-coral" />
            Weaknesses
          </h2>
          <ul className="space-y-2">
            {recruiter.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-300">
                <span className="w-1.5 h-1.5 rounded-full bg-coral mt-2 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggestions */}
      <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
          <Lightbulb size={16} className="text-sky-cool" />
          Actionable Suggestions
        </h2>
        <ol className="space-y-3">
          {recruiter.suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink-300">
              <span className="flex-shrink-0 w-5 h-5 rounded-full border border-sky-cool/40 text-sky-cool text-xs font-mono font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* Rewritten bullets */}
      {rewritten_bullets.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
          <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-acid" />
            Rewritten Bullet Points
          </h2>
          <div className="space-y-3">
            {visibleBullets.map((b, i) => (
              <BulletCard key={i} original={b.original} improved={b.improved} />
            ))}
          </div>
          {rewritten_bullets.length > 3 && (
            <button
              onClick={() => setShowAllBullets(!showAllBullets)}
              className="mt-3 text-xs text-ink-500 hover:text-acid flex items-center gap-1 font-mono transition-colors"
            >
              {showAllBullets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAllBullets ? 'Show fewer' : `Show all ${rewritten_bullets.length} rewrites`}
            </button>
          )}
        </div>
      )}

      {/* Skill Gap Roadmap */}
      {analysisId && <SkillGapCard analysisId={analysisId} />}

      {/* AI Resume Auto-Editor */}
      {analysisId && resumeText && <AutoEditorCard analysisId={analysisId} resumeText={resumeText} />}

      {/* Resume Evolution Tracker */}
      {resumeId && <EvolutionCard resumeId={resumeId} />}

      {/* Cover Letter Generator */}
      {analysisId && <CoverLetterCard analysisId={analysisId} />}

      {/* CTA */}
      <div className="mt-10 flex gap-4 flex-wrap">
        <button
          onClick={() => nav('/dashboard')}
          className="btn-primary flex items-center gap-2"
        >
          <TrendingUp size={16} />
          Analyze Another Resume
        </button>
        <button
          onClick={() => downloadAnalysisPDF(data)}
          className="btn-ghost flex items-center gap-2"
        >
          <Download size={15} />
          Download PDF Report
        </button>
      </div>
    </div>
  )
}