import type { JDIntelligence } from '../../types'
import {
  ScanSearch, CheckCircle2, PlusCircle, Briefcase,
  ListChecks, GraduationCap,
} from 'lucide-react'

export default function JDIntelligenceCard({ data }: { data: JDIntelligence }) {
  const hasContent =
    data.role_summary ||
    data.required_skills.length > 0 ||
    data.nice_to_have_skills.length > 0 ||
    data.experience_level ||
    data.key_responsibilities.length > 0 ||
    data.education

  if (!hasContent) return null

  return (
    <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
      <h2 className="font-display font-bold text-white mb-1 flex items-center gap-2">
        <ScanSearch size={16} className="text-sky-cool" />
        JD Intelligence
      </h2>
      <p className="text-ink-500 text-xs mb-5">
        What this job description is really asking for, extracted automatically.
      </p>

      {data.role_summary && (
        <p className="text-ink-200 text-sm leading-relaxed mb-5 border-l-2 border-sky-cool/40 pl-3">
          {data.role_summary}
        </p>
      )}

      {/* Experience + education meta */}
      {(data.experience_level || data.education) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {data.experience_level && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200">
              <Briefcase size={12} className="text-sky-cool" />
              {data.experience_level}
            </span>
          )}
          {data.education && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-ink-200">
              <GraduationCap size={12} className="text-sky-cool" />
              {data.education}
            </span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Required skills */}
        {data.required_skills.length > 0 && (
          <div>
            <h3 className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-acid" />
              Required Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.required_skills.map(s => (
                <span
                  key={s}
                  className="text-xs font-mono px-2.5 py-1 rounded-full bg-acid/10 border border-acid/30 text-acid"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nice to have */}
        {data.nice_to_have_skills.length > 0 && (
          <div>
            <h3 className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <PlusCircle size={13} className="text-sky-cool" />
              Nice to Have
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.nice_to_have_skills.map(s => (
                <span
                  key={s}
                  className="text-xs font-mono px-2.5 py-1 rounded-full bg-sky-cool/10 border border-sky-cool/30 text-sky-cool"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Responsibilities */}
      {data.key_responsibilities.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <ListChecks size={13} className="text-ink-300" />
            Key Responsibilities
          </h3>
          <ul className="space-y-2">
            {data.key_responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-300">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-cool mt-2 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
