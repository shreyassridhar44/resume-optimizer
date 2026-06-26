import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getUserHistory, deleteAnalysis } from '../../services/api'
import type { HistoryItem } from '../../types'
import { Clock, ChevronRight, BarChart2, TrendingUp, FileText, Trash2 } from 'lucide-react'

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100
  const color = pct >= 70 ? 'text-acid bg-acid/10 border-acid/20' :
    pct >= 45 ? 'text-sky-cool bg-sky-cool/10 border-sky-cool/20' :
    'text-coral bg-coral/10 border-coral/20'
  return (
    <span className={`chip border ${color} font-bold`}>
      {score.toFixed(max === 10 ? 1 : 0)}/{max}
    </span>
  )
}

export default function HistoryPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getUserHistory()
      .then(r => setItems(r.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleDelete = async (analysisId: string) => {
    if (!user) return
    setDeletingId(analysisId)
    try {
      await deleteAnalysis(analysisId)
      setItems(prev => prev.filter(i => i.analysis_id !== analysisId))
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Clock size={26} className="text-acid" />
          Analysis History
        </h1>
        <p className="text-ink-400 text-sm">
          {items.length} {items.length === 1 ? 'analysis' : 'analyses'} saved
        </p>
      </div>

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <FileText size={36} className="text-ink-600 mx-auto mb-4" />
          <p className="text-ink-400 font-display font-semibold text-lg mb-2">No analyses yet</p>
          <p className="text-ink-600 text-sm mb-6">Upload a resume to get started.</p>
          <button onClick={() => nav('/dashboard')} className="btn-primary">
            Analyze Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={item.analysis_id}
              className="glass-hover rounded-xl p-5 flex items-start gap-4 animate-fade-up group relative"
              style={{ animationDelay: `${i * 0.06}s`, opacity: 0 }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-lg bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer group-hover:border-acid/30 transition-colors"
                onClick={() => nav(`/dashboard/results/${item.analysis_id}`)}
              >
                <BarChart2 size={16} className="text-ink-400 group-hover:text-acid transition-colors" />
              </div>

              {/* Content */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => nav(`/dashboard/results/${item.analysis_id}`)}
              >
                <p className="text-ink-200 text-sm mb-2 line-clamp-2 leading-relaxed">
                  {item.jd_preview || 'Job description not available'}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span>ATS</span>
                    <ScoreBadge score={item.ats_score} max={100} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span>Recruiter</span>
                    <ScoreBadge score={item.recruiter_score} max={10} />
                  </div>
                  <span className="text-ink-600 text-xs font-mono ml-auto">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <ChevronRight
                  size={14}
                  className="text-ink-600 group-hover:text-acid mt-1 transition-colors cursor-pointer"
                  onClick={() => nav(`/dashboard/results/${item.analysis_id}`)}
                />

                {/* Delete */}
                {confirmId === item.analysis_id ? (
                  <div className="flex items-center gap-2 bg-coral/10 border border-coral/20 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-coral font-mono">Delete?</span>
                    <button
                      onClick={() => handleDelete(item.analysis_id)}
                      disabled={deletingId === item.analysis_id}
                      className="text-xs text-coral font-bold hover:text-white transition-colors"
                    >
                      {deletingId === item.analysis_id ? '...' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-ink-400 hover:text-ink-200 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmId(item.analysis_id) }}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-coral/10 hover:text-coral text-ink-600"
                    title="Delete analysis"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 glass rounded-xl p-5">
          <h3 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-acid" />
            Score Trend
          </h3>
          <div className="flex items-end gap-2 h-16">
            {items.slice(-10).reverse().map((item, i) => {
              const h = Math.max(4, (item.ats_score / 100) * 64)
              const color = item.ats_score >= 70 ? '#a3ff47' : item.ats_score >= 45 ? '#47c8ff' : '#ff6b47'
              return (
                <div
                  key={item.analysis_id}
                  className="flex-1 rounded-t transition-all"
                  style={{ height: h, background: color, opacity: 0.5 + (i / 20) }}
                  title={`ATS: ${item.ats_score.toFixed(0)}%`}
                />
              )
            })}
          </div>
          <p className="text-ink-600 text-xs font-mono mt-2">ATS score over last 10 analyses →</p>
        </div>
      )}
    </div>
  )
}