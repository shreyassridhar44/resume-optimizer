import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { uploadResume, analyzeResume } from '../../services/api'
import type { RoleType, PersonaType, LoadingStep } from '../../types'
import {
  Upload, FileText, X, Briefcase, Code2,
  BarChart2, Sparkles, ChevronRight, AlertCircle,
  Building2, Rocket, Users, UserCheck,
} from 'lucide-react'

const ROLE_OPTIONS: { value: RoleType; label: string; icon: React.ReactNode }[] = [
  { value: 'general', label: 'General', icon: <Briefcase size={14} /> },
  { value: 'sde', label: 'SDE', icon: <Code2 size={14} /> },
  { value: 'ml', label: 'ML Engineer', icon: <Sparkles size={14} /> },
  { value: 'analyst', label: 'Analyst', icon: <BarChart2 size={14} /> },
]

const PERSONA_OPTIONS: {
  value: PersonaType
  label: string
  blurb: string
  icon: React.ReactNode
}[] = [
  { value: 'standard', label: 'Standard', blurb: 'Balanced senior recruiter', icon: <UserCheck size={14} /> },
  { value: 'faang', label: 'FAANG', blurb: 'Scale & system-design depth', icon: <Building2 size={14} /> },
  { value: 'startup', label: 'Startup', blurb: 'Ownership & shipping speed', icon: <Rocket size={14} /> },
  { value: 'hr', label: 'HR', blurb: 'Culture fit & communication', icon: <Users size={14} /> },
]

const STEP_LABELS: Record<LoadingStep, string> = {
  idle: '',
  uploading: 'Uploading your resume...',
  parsing: 'Extracting text & parsing sections...',
  ats: 'Running ATS keyword matching...',
  recruiter: 'Simulating recruiter evaluation...',
  rewriting: 'Rewriting bullet points...',
  saving: 'Saving your analysis...',
  done: 'Done!',
  error: 'Something went wrong',
}

export default function UploadPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [jd, setJd] = useState('')
  const [roleType, setRoleType] = useState<RoleType>('general')
  const [persona, setPersona] = useState<PersonaType>('standard')
  const [step, setStep] = useState<LoadingStep>('idle')
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const isReady = file && jd.trim().length >= 50
  const isLoading = step !== 'idle' && step !== 'error'

  const handleAnalyze = async () => {
    if (!isReady || !user) return
    setError('')

    try {
      // Step 1: Upload
      setStep('uploading')
      const uploaded = await uploadResume(file!)

      // Step 2: Parsing (visual only — happens server-side during upload)
      setStep('parsing')
      await new Promise(r => setTimeout(r, 600))

      // Step 3: ATS
      setStep('ats')
      await new Promise(r => setTimeout(r, 400))

      // Step 4: Full analysis (recruiter + rewrite)
      setStep('recruiter')
      const result = await analyzeResume({
        resumeId: uploaded.resume_id,
        jobDescription: jd,
        roleType,
        persona,
      })

      setStep('done')
      nav(`/dashboard/results/${result.data.analysis_id}`, {
        state: {
          result: result.data,
          resumeText: uploaded.parsed_text,
          resumeId: uploaded.resume_id,
        }
      })
    } catch (err: unknown) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Analyze Your Resume
        </h1>
        <p className="text-ink-400 text-sm">
          Upload your resume + paste a job description to get your ATS score and AI recruiter feedback.
        </p>
      </div>

      <div className="space-y-6">
        {/* File Drop Zone */}
        <section>
          <label className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 block">
            01 — Resume File
          </label>

          {file ? (
            <div className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-acid/10 border border-acid/20 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-acid" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{file.name}</p>
                <p className="text-ink-500 text-xs">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-ink-500 hover:text-coral transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-acid bg-acid/5'
                  : 'border-ink-700 hover:border-ink-500 hover:bg-ink-800/30'
              }`}
            >
              <input {...getInputProps()} />
              <Upload
                size={28}
                className={`mx-auto mb-3 ${isDragActive ? 'text-acid' : 'text-ink-500'}`}
              />
              <p className="text-ink-300 text-sm font-medium mb-1">
                {isDragActive ? 'Drop it!' : 'Drop your resume here'}
              </p>
              <p className="text-ink-600 text-xs">PDF or DOCX · max 10 MB</p>
            </div>
          )}
        </section>

        {/* Job Description */}
        <section>
          <label className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 block">
            02 — Job Description
          </label>
          <textarea
            value={jd}
            onChange={e => setJd(e.target.value)}
            placeholder="Paste the full job description here (at least 50 characters)..."
            rows={7}
            className="w-full bg-ink-800 border border-ink-700 rounded-xl px-4 py-3 text-ink-100 text-sm placeholder:text-ink-600 focus:outline-none focus:border-acid/40 resize-none transition-colors"
          />
          <p className={`text-xs mt-1.5 font-mono text-right ${jd.length >= 50 ? 'text-acid' : 'text-ink-600'}`}>
            {jd.length} chars {jd.length < 50 ? `(need ${50 - jd.length} more)` : '✓'}
          </p>
        </section>

        {/* Role Type */}
        <section>
          <label className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 block">
            03 — Target Role Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRoleType(opt.value)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-body transition-all ${
                  roleType === opt.value
                    ? 'bg-acid/10 border-acid/40 text-acid'
                    : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Recruiter Persona */}
        <section>
          <label className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 block">
            04 — Recruiter Persona
          </label>
          <p className="text-ink-500 text-xs mb-3">
            Pick whose eyes evaluate your resume. Each persona weighs your experience differently.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PERSONA_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPersona(opt.value)}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all ${
                  persona === opt.value
                    ? 'bg-acid/10 border-acid/40'
                    : 'border-ink-700 hover:border-ink-500'
                }`}
              >
                <span className={`flex items-center gap-2 text-sm font-body ${
                  persona === opt.value ? 'text-acid' : 'text-ink-200'
                }`}>
                  {opt.icon}
                  {opt.label}
                </span>
                <span className="text-[11px] leading-tight text-ink-500">{opt.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-coral/10 border border-coral/20 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
            <p className="text-coral text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleAnalyze}
          disabled={!isReady || isLoading}
          className="btn-primary w-full flex items-center justify-center gap-3 text-base py-4 shadow-[0_0_40px_rgba(163,255,71,0.15)] disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-ink-900 font-display">{STEP_LABELS[step]}</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Analyze Resume
              <ChevronRight size={16} />
            </>
          )}
        </button>

        {/* Loading steps visual */}
        {isLoading && (
          <div className="glass rounded-xl p-4">
            <div className="space-y-2">
              {(['uploading', 'parsing', 'ats', 'recruiter'] as LoadingStep[]).map((s, i) => {
                const steps: LoadingStep[] = ['uploading', 'parsing', 'ats', 'recruiter', 'saving', 'done']
                const currentIdx = steps.indexOf(step)
                const thisIdx = steps.indexOf(s)
                const isDone = thisIdx < currentIdx
                const isCurrent = s === step

                return (
                  <div key={s} className="flex items-center gap-3 text-xs font-mono">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 transition-all ${
                      isDone ? 'bg-acid border-acid text-ink-900 font-bold' :
                      isCurrent ? 'border-acid text-acid animate-pulse' :
                      'border-ink-700 text-ink-600'
                    }`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={isDone ? 'text-acid' : isCurrent ? 'text-ink-200' : 'text-ink-600'}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}