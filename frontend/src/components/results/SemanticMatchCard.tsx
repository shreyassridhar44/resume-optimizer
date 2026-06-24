import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SemanticMatch } from '../../types'

interface Props {
  data: SemanticMatch
}

function scoreColor(score: number): string {
  return score >= 70 ? '#a3ff47' : score >= 55 ? '#47c8ff' : '#ff6b47'
}

export default function SemanticMatchCard({ data }: Props) {
  const semanticColor = scoreColor(data.score)
  const keywordColor = scoreColor(data.keyword_score)
  
  // Determine comparison icon and color
  const getDifferenceDisplay = () => {
    const diff = data.score_difference
    const absDiff = Math.abs(diff)
    
    if (absDiff < 5) {
      return {
        icon: <Minus size={16} className="text-ink-400" />,
        text: "Similar",
        color: "text-ink-400",
        bgColor: "bg-ink-800/40",
      }
    } else if (diff > 0) {
      return {
        icon: <TrendingUp size={16} className="text-acid" />,
        text: `+${absDiff.toFixed(1)}% higher`,
        color: "text-acid",
        bgColor: "bg-acid/10",
      }
    } else {
      return {
        icon: <TrendingDown size={16} className="text-coral" />,
        text: `${absDiff.toFixed(1)}% lower`,
        color: "text-coral",
        bgColor: "bg-coral/10",
      }
    }
  }
  
  const diffDisplay = getDifferenceDisplay()

  return (
    <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: '0.16s' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Brain size={16} className="text-sky-cool" />
          Semantic Matching
        </h2>
        <div className="text-right">
          <div className="font-display font-bold text-2xl leading-none" style={{ color: semanticColor }}>
            {data.score.toFixed(0)}%
          </div>
          <div className="text-ink-500 text-[10px] font-mono uppercase tracking-widest">
            Meaning Match
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-ink-800/40 rounded-lg p-4 border border-ink-700 mb-5">
        <p className="text-ink-300 text-sm leading-relaxed">
          {data.interpretation}
        </p>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Semantic Score */}
        <div className="bg-ink-900/50 rounded-lg p-4 border border-ink-700">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-sky-cool" />
            <span className="text-[10px] font-mono text-ink-500 uppercase tracking-widest">Semantic</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-display font-bold text-3xl" style={{ color: semanticColor }}>
              {data.score.toFixed(0)}
            </div>
            <div className="text-ink-500 text-sm font-mono">/ 100</div>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Meaning-based match using ML embeddings
          </p>
        </div>

        {/* Keyword Score */}
        <div className="bg-ink-900/50 rounded-lg p-4 border border-ink-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono text-ink-500 uppercase tracking-widest">Keyword</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-display font-bold text-3xl" style={{ color: keywordColor }}>
              {data.keyword_score.toFixed(0)}
            </div>
            <div className="text-ink-500 text-sm font-mono">/ 100</div>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Traditional ATS keyword matching
          </p>
        </div>
      </div>

      {/* Difference Highlight */}
      <div className={`${diffDisplay.bgColor} rounded-lg p-4 border ${diffDisplay.color === 'text-acid' ? 'border-acid/30' : diffDisplay.color === 'text-coral' ? 'border-coral/30' : 'border-ink-700'}`}>
        <div className="flex items-center gap-3">
          {diffDisplay.icon}
          <div className="flex-1">
            <div className={`font-display font-bold ${diffDisplay.color} mb-1`}>
              Semantic vs Keyword: {diffDisplay.text}
            </div>
            <p className="text-xs text-ink-400 leading-relaxed">
              {data.score_difference > 5 && "Semantic matching captures deeper alignment beyond exact keyword matches — your conceptual fit is stronger than keyword analysis alone suggests."}
              {data.score_difference < -5 && "Keyword matching is higher — consider incorporating more role-specific terminology to strengthen semantic alignment."}
              {Math.abs(data.score_difference) <= 5 && "Both methods agree — your resume has consistent alignment with this role across keyword and semantic dimensions."}
            </p>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="mt-5 pt-5 border-t border-ink-700">
        <details className="group">
          <summary className="cursor-pointer text-xs text-ink-500 font-mono hover:text-ink-400 transition-colors list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Technical Details
          </summary>
          <div className="mt-3 space-y-2 text-xs font-mono text-ink-500">
            <div className="flex justify-between">
              <span>Embedding Model:</span>
              <span className="text-ink-400">LLM-based semantic extraction</span>
            </div>
            <div className="flex justify-between">
              <span>Vector Dimensions:</span>
              <span className="text-ink-400">{data.embedding_dimensions}</span>
            </div>
            <div className="flex justify-between">
              <span>Raw Similarity:</span>
              <span className="text-ink-400">{data.raw_similarity.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Algorithm:</span>
              <span className="text-ink-400">Cosine similarity</span>
            </div>
          </div>
        </details>
      </div>

      {/* Footer */}
      <div className="mt-5 pt-5 border-t border-ink-700">
        <p className="text-xs text-ink-500 font-mono">
          🧠 <strong className="text-ink-400">AI-Powered:</strong> Semantic matching uses ML to understand meaning, not just keywords — revealing conceptual fit beyond surface-level matches.
        </p>
      </div>
    </div>
  )
}
