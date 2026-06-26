import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { generateSkillGapRoadmap } from '../../services/api'
import type { SkillGapRoadmap, SkillPriority } from '../../types'
import {
  Map, Sparkles, AlertCircle, CheckCircle2, Target,
  ChevronDown, ChevronUp, Clock, RefreshCw,
} from 'lucide-react'

const PRIORITY_STYLES: Record<SkillPriority, { dot: string; chip: string; label: string }> = {
  high: { dot: 'bg-coral', chip: 'bg-coral/10 border-coral/30 text-coral', label: 'High priority' },
  medium: { dot: 'bg-sky-cool', chip: 'bg-sky-cool/10 border-sky-cool/30 text-sky-cool', label: 'Medium' },
  low: { dot: 'bg-ink-500', chip: 'bg-ink-800 border-ink-700 text-ink-400', label: 'Low' },
}

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 70 ? '#a3ff47' : score >= 45 ? '#47c8ff' : '#ff6b47'
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-ink-300 text-sm font-mono">Role Readiness</span>
        <span className="font-display font-bold text-xl" style={{ color }}>{score}%</span>
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
    </div>
  )
}

function SkillGapItemRow({
  skill, priority, reason, learning_path, estimated_time,
}: SkillGapRoadmap['missing_skills'][number]) {
  const [open, setOpen] = useState(false)
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium
  return (
    <div className="border border-ink-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-ink-800/40 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
        <span className="text-white text-sm font-medium flex-1">{skill}</span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${style.chip}`}>
          {style.label}
        </span>
        {estimated_time && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-ink-500">
            <Clock size={11} />
            {estimated_time}
          </span>
        )}
        {open ? <ChevronUp size={15} className="text-ink-500" /> : <ChevronDown size={15} className="text-ink-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-ink-700/50">
          {reason && <p className="text-ink-400 text-sm mb-3 italic">{reason}</p>}
          {learning_path.length > 0 && (
            <ol className="space-y-2">
              {learning_path.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-acid/40 text-acid text-xs font-mono font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

export default function SkillGapCard({ analysisId }: { analysisId: string }) {
  const { user } = useAuth()
  const [roadmap, setRoadmap] = useState<SkillGapRoadmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const res = await generateSkillGapRoadmap({ analysisId })
      setRoadmap(res.roadmap)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate roadmap.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.26s' }}>
      <h2 className="font-display font-bold text-white mb-1 flex items-center gap-2">
        <Map size={16} className="text-acid" />
        Skill Gap Roadmap
      </h2>
      <p className="text-ink-500 text-xs mb-5">
        See what to learn to qualify for this role, with a step-by-step path for each gap.
      </p>

      {error && (
        <div className="flex items-start gap-3 bg-coral/10 border border-coral/20 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
          <p className="text-coral text-sm">{error}</p>
        </div>
      )}

      {!roadmap && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-ink-900 font-display">Building your roadmap...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Skill Gap Roadmap
            </>
          )}
        </button>
      )}

      {roadmap && (
        <div className="animate-fade-in">
          <ReadinessBar score={roadmap.readiness_score} />

          {roadmap.summary && (
            <p className="text-ink-200 text-sm leading-relaxed mb-5 border-l-2 border-acid/40 pl-3">
              {roadmap.summary}
            </p>
          )}

          {/* Matched skills */}
          {roadmap.matched_skills.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-acid" />
                Skills You Already Have
              </h3>
              <div className="flex flex-wrap gap-2">
                {roadmap.matched_skills.map(s => (
                  <span key={s} className="text-xs font-mono px-2.5 py-1 rounded-full bg-acid/10 border border-acid/30 text-acid">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing skills with paths */}
          {roadmap.missing_skills.length > 0 ? (
            <div>
              <h3 className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Target size={13} className="text-coral" />
                Skills to Learn ({roadmap.missing_skills.length})
              </h3>
              <div className="space-y-2">
                {roadmap.missing_skills.map((item, i) => (
                  <SkillGapItemRow key={i} {...item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-acid text-sm flex items-center gap-2">
              <CheckCircle2 size={15} />
              No major skill gaps detected — you're well aligned with this role.
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-ghost w-full flex items-center justify-center gap-2 mt-5 disabled:opacity-60"
          >
            <RefreshCw size={14} />
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      )}
    </div>
  )
}
