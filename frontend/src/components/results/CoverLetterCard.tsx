import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { generateCoverLetter } from '../../services/api'
import type { CoverLetterTone } from '../../types'
import {
  Mail, Sparkles, Copy, Check, Download, AlertCircle, RefreshCw,
} from 'lucide-react'

const TONE_OPTIONS: { value: CoverLetterTone; label: string; blurb: string }[] = [
  { value: 'professional', label: 'Professional', blurb: 'Polished & formal' },
  { value: 'enthusiastic', label: 'Enthusiastic', blurb: 'Warm & energetic' },
  { value: 'concise', label: 'Concise', blurb: 'Tight & punchy' },
]

export default function CoverLetterCard({ analysisId }: { analysisId: string }) {
  const { user } = useAuth()
  const [tone, setTone] = useState<CoverLetterTone>('professional')
  const [applicantName, setApplicantName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const res = await generateCoverLetter({
        analysisId,
        tone,
        applicantName: applicantName.trim(),
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim(),
      })
      setLetter(res.cover_letter)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate cover letter.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!letter) return
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const handleDownloadTxt = () => {
    if (!letter) return
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cover-letter.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    if (!letter) return
    
    // Create a formatted HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cover Letter</title>
  <style>
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      max-width: 650px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 30px;
      color: #1a1a1a;
    }
    p {
      margin-bottom: 16px;
      text-align: justify;
    }
    .date {
      margin-bottom: 30px;
      color: #666;
    }
    .signature {
      margin-top: 30px;
    }
    @media print {
      body { margin: 0; padding: 40px; }
    }
  </style>
</head>
<body>
  <div class="date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  ${letter.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('\n  ')}
</body>
</html>
    `.trim()
    
    // Open in new tab for printing as PDF
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      
      // Auto-trigger print dialog after a brief delay
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  return (
    <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.28s' }}>
      <h2 className="font-display font-bold text-white mb-1 flex items-center gap-2">
        <Mail size={16} className="text-sky-cool" />
        Auto Cover Letter Generator
      </h2>
      <p className="text-ink-500 text-xs mb-5">
        Generate a cover letter tailored to this resume + job description.
      </p>

      {/* Optional details */}
      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        <input
          value={applicantName}
          onChange={e => setApplicantName(e.target.value)}
          placeholder="Your name (optional)"
          className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-ink-100 text-sm placeholder:text-ink-600 focus:outline-none focus:border-acid/40 transition-colors"
        />
        <input
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Company (optional)"
          className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-ink-100 text-sm placeholder:text-ink-600 focus:outline-none focus:border-acid/40 transition-colors"
        />
        <input
          value={roleTitle}
          onChange={e => setRoleTitle(e.target.value)}
          placeholder="Role title (optional)"
          className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-ink-100 text-sm placeholder:text-ink-600 focus:outline-none focus:border-acid/40 transition-colors"
        />
      </div>

      {/* Tone selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {TONE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTone(opt.value)}
            className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-left transition-all ${
              tone === opt.value
                ? 'bg-acid/10 border-acid/40'
                : 'border-ink-700 hover:border-ink-500'
            }`}
          >
            <span className={`text-sm font-body ${tone === opt.value ? 'text-acid' : 'text-ink-200'}`}>
              {opt.label}
            </span>
            <span className="text-[11px] leading-tight text-ink-500">{opt.blurb}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-coral/10 border border-coral/20 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-coral mt-0.5 shrink-0" />
          <p className="text-coral text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-ink-900 font-display">Writing your cover letter...</span>
          </>
        ) : letter ? (
          <>
            <RefreshCw size={16} />
            Regenerate
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate Cover Letter
          </>
        )}
      </button>

      {/* Output */}
      {letter && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-ink-500 uppercase tracking-widest">
              Generated Letter
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-mono text-ink-400 hover:text-acid transition-colors"
              >
                {copied ? <Check size={13} className="text-acid" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1.5 text-xs font-mono text-ink-400 hover:text-acid transition-colors"
              >
                <Download size={13} />
                .txt
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 text-xs font-mono text-ink-400 hover:text-sky-cool transition-colors"
              >
                <Download size={13} />
                PDF
              </button>
            </div>
          </div>
          <textarea
            value={letter}
            onChange={e => setLetter(e.target.value)}
            rows={16}
            className="w-full bg-ink-800/60 border border-ink-700 rounded-xl px-4 py-3 text-ink-100 text-sm leading-relaxed focus:outline-none focus:border-acid/40 resize-y whitespace-pre-wrap"
          />
          <p className="text-ink-600 text-[11px] mt-1.5">
            You can edit the text above before copying or downloading.
          </p>
        </div>
      )}
    </div>
  )
}
