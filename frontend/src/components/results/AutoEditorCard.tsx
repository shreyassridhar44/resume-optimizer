import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getAutoEditSuggestions, applyResumeEdits } from '../../services/api'
import type { EditSuggestion, AutoEditSuggestionsResponse, ApplyEditsResponse } from '../../types'
import { Wand2, CheckCircle2, Download, ChevronDown, ChevronUp, Loader2, AlertCircle, FileText } from 'lucide-react'

interface Props {
  analysisId: string
  resumeText: string
}

const PRIORITY_COLORS = {
  high: '#ff6b47', // coral
  medium: '#47c8ff', // sky-cool
  low: '#a3ff47', // acid
}

const PRIORITY_ICONS = {
  high: '🔥',
  medium: '⚡',
  low: '💡',
}

const SECTION_LABELS: Record<string, string> = {
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  summary: 'Summary',
}

export default function AutoEditorCard({ analysisId, resumeText }: Props) {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([])
  const [summary, setSummary] = useState('')
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApplyEditsResponse | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)

  const loadSuggestions = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const response = await getAutoEditSuggestions({
        analysisId,
        maxSuggestions: 10,
      })
      setSuggestions(response.suggestions)
      setSummary(response.summary)
      // Auto-select high priority suggestions
      const highPriorityIndices = response.suggestions
        .map((s, i) => (s.priority === 'high' ? i : -1))
        .filter(i => i !== -1)
      setSelectedSuggestions(new Set(highPriorityIndices))
      setExpanded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setLoading(false)
    }
  }

  const toggleSuggestion = (index: number) => {
    const newSet = new Set(selectedSuggestions)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedSuggestions(newSet)
  }

  const applyEdits = async (format: 'pdf' | 'docx' | 'both') => {
    if (!user || selectedSuggestions.size === 0) return
    setApplying(true)
    setError('')
    try {
      const selectedSugs = Array.from(selectedSuggestions).map(i => suggestions[i])
      const response = await applyResumeEdits({
        analysisId,
        resumeText,
        appliedSuggestions: selectedSugs,
        format,
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edits')
    } finally {
      setApplying(false)
    }
  }

  const downloadFile = (url: string, filename: string) => {
    // Open in new tab instead of downloading
    window.open(url, '_blank')
  }

  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 5)

  if (result) {
    return (
      <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.35s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-acid" />
            Resume Optimized! ✨
          </h2>
        </div>

        <div className="bg-ink-800/60 border border-ink-700 rounded-xl p-5 mb-4">
          <h3 className="font-mono text-xs uppercase text-ink-500 mb-2">📝 Edited Resume Text</h3>
          <div className="bg-ink-900 rounded-lg p-4 max-h-64 overflow-y-auto">
            <pre className="text-ink-200 text-sm font-mono whitespace-pre-wrap leading-relaxed">
              {result.edited_text}
            </pre>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.edited_text)
                alert('✅ Copied to clipboard! Paste into your original resume.')
              }}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <FileText size={12} />
              Copy Text
            </button>
          </div>
        </div>

        <div className="bg-acid/5 border border-acid/20 rounded-xl p-5 mb-5">
          <p className="text-ink-300 text-sm mb-3">{result.changes_summary}</p>
          
          <div className="flex flex-wrap gap-3">
            {result.files.map((file) => (
              <button
                key={file.format}
                onClick={() => downloadFile(file.download_url, file.filename)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Download size={14} />
                {file.filename.endsWith('.tex') ? 'Download LaTeX Source' : `Download ${file.format.toUpperCase()}`}
                <span className="text-[10px] opacity-70">
                  ({Math.round(file.size_bytes / 1024)}KB)
                </span>
              </button>
            ))}
          </div>
          
          <div className="mt-4 bg-sky-cool/10 border border-sky-cool/30 rounded-lg p-3">
            <p className="text-xs text-sky-cool leading-relaxed">
              📝 <strong>LaTeX Source (.tex):</strong> Upload to <a href="https://www.overleaf.com" target="_blank" rel="noopener" className="underline">Overleaf.com</a> (free) 
              or compile locally with pdflatex for a perfectly formatted PDF. This preserves ALL original formatting!
              <br />
              📄 <strong>DOCX:</strong> Ready to use immediately in Microsoft Word or Google Docs.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setResult(null)
            setSuggestions([])
            setSelectedSuggestions(new Set())
            setExpanded(false)
          }}
          className="text-xs text-ink-500 hover:text-acid font-mono transition-colors"
        >
          ← Generate new suggestions
        </button>
      </div>
    )
  }

  if (!expanded && suggestions.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.35s' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-white flex items-center gap-2 mb-1">
              <Wand2 size={16} className="text-acid" />
              AI Resume Auto-Editor
            </h2>
            <p className="text-ink-500 text-xs font-mono">
              Get AI suggestions and download optimized files
            </p>
          </div>
        </div>

        <div className="bg-sky-cool/10 border border-sky-cool/30 rounded-lg p-3 mb-4">
          <p className="text-sky-cool text-xs leading-relaxed">
            ℹ️ <strong>LaTeX-Powered Editing:</strong> We convert your resume to LaTeX format to preserve ALL formatting perfectly. 
            You'll get: (1) Edited LaTeX source (.tex file) - compile with pdflatex or upload to Overleaf for perfect PDF, 
            (2) DOCX with edits applied for immediate use.
          </p>
        </div>

        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="btn-primary flex items-center gap-2 w-full justify-center"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating suggestions...
            </>
          ) : (
            <>
              <Wand2 size={14} />
              Generate Edit Suggestions
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 bg-coral/10 border border-coral/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={14} className="text-coral mt-0.5 shrink-0" />
            <p className="text-coral text-xs">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.35s' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-bold text-white flex items-center gap-2 mb-1">
            <Wand2 size={16} className="text-acid" />
            AI Resume Auto-Editor
          </h2>
          <p className="text-ink-500 text-xs font-mono">
            {selectedSuggestions.size} of {suggestions.length} suggestions selected
          </p>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-2xl text-acid">{suggestions.length}</div>
          <div className="text-ink-500 text-[10px] font-mono uppercase tracking-widest">
            Suggestions
          </div>
        </div>
      </div>

      {summary && (
        <div className="mb-5 p-4 bg-ink-800/40 rounded-xl border border-ink-700">
          <p className="text-ink-300 text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3 mb-5">
          {visibleSuggestions.map((sug, idx) => {
            const isSelected = selectedSuggestions.has(idx)
            const priorityColor = PRIORITY_COLORS[sug.priority]

            return (
              <div
                key={idx}
                onClick={() => toggleSuggestion(idx)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-acid/40 bg-acid/5'
                    : 'border-ink-700 hover:border-ink-600 bg-ink-800/20'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-acid bg-acid'
                        : 'border-ink-600'
                    }`}
                  >
                    {isSelected && <CheckCircle2 size={12} className="text-ink-900" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${priorityColor}20`,
                          color: priorityColor,
                          border: `1px solid ${priorityColor}40`,
                        }}
                      >
                        {PRIORITY_ICONS[sug.priority]} {sug.priority}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-ink-500 px-2 py-0.5 rounded bg-ink-800">
                        {SECTION_LABELS[sug.section] || sug.section}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-ink-500 px-2 py-0.5 rounded bg-ink-800">
                        {sug.type}
                      </span>
                    </div>

                    <p className="text-ink-300 text-sm mb-2">{sug.reason}</p>

                    {sug.impact && (
                      <p className="text-xs text-sky-cool font-mono mb-3">
                        💡 Impact: {sug.impact}
                      </p>
                    )}

                    {sug.original_text && (
                      <div className="bg-ink-900/50 rounded-lg p-3 mb-2 border border-ink-700">
                        <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">
                          Original
                        </div>
                        <p className="text-ink-400 text-xs">{sug.original_text}</p>
                      </div>
                    )}

                    <div className="bg-acid/5 rounded-lg p-3 border border-acid/20">
                      <div className="text-[10px] font-mono uppercase text-acid mb-1">
                        Suggested
                      </div>
                      <p className="text-white text-xs">{sug.suggested_text}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {suggestions.length > 5 && (
        <button
          onClick={() => setShowAllSuggestions(!showAllSuggestions)}
          className="text-xs text-ink-500 hover:text-acid flex items-center gap-1 font-mono transition-colors mb-5"
        >
          {showAllSuggestions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showAllSuggestions ? 'Show fewer' : `Show all ${suggestions.length} suggestions`}
        </button>
      )}

      {selectedSuggestions.size > 0 && (
        <div className="border-t border-ink-700 pt-5">
          <p className="text-ink-400 text-xs mb-4 font-mono">
            Apply {selectedSuggestions.size} selected suggestion{selectedSuggestions.size !== 1 ? 's' : ''} and generate:
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => applyEdits('pdf')}
              disabled={applying}
              className="btn-primary flex items-center gap-2"
            >
              {applying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              PDF Only
            </button>
            <button
              onClick={() => applyEdits('docx')}
              disabled={applying}
              className="btn-primary flex items-center gap-2"
            >
              {applying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              DOCX Only
            </button>
            <button
              onClick={() => applyEdits('both')}
              disabled={applying}
              className="btn-primary flex items-center gap-2"
            >
              {applying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Both (PDF + DOCX)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-coral/10 border border-coral/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-coral mt-0.5 shrink-0" />
          <p className="text-coral text-xs">{error}</p>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-ink-700">
        <p className="text-xs text-ink-500 font-mono">
          💡 <strong className="text-ink-400">Tip:</strong> High priority suggestions are pre-selected. 
          Review and toggle any suggestion by clicking on it before generating files.
        </p>
      </div>
    </div>
  )
}
