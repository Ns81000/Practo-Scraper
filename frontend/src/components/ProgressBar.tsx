interface ProgressBarProps {
  current: number
  total: number
  phase: 'idle' | 'discovery' | 'extraction' | 'complete'
  message?: string
}

const phaseLabels: Record<string, string> = {
  idle: 'Ready',
  discovery: 'Discovering Doctors',
  extraction: 'Extracting Profiles',
  complete: 'Complete',
}

export function ProgressBar({ current, total, phase, message }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0
  const isActive = phase === 'discovery' || phase === 'extraction'

  return (
    <div className="w-full">
      {/* Phase label & count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clay-brand-teal opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-clay-brand-teal" />
            </span>
          )}
          <span className="text-caption font-medium text-clay-body-strong">
            {phaseLabels[phase] || phase}
          </span>
        </div>
        <span className="text-caption text-clay-muted">
          {phase === 'complete'
            ? `${current} profiles extracted`
            : total > 0
              ? `${current} / ${total}`
              : '—'}
        </span>
      </div>

      {/* Progress bar track */}
      <div
        className="w-full h-2 rounded-[var(--radius-clay-pill)] overflow-hidden"
        style={{ backgroundColor: 'var(--color-clay-surface-strong)' }}
      >
        <div
          className={[
            'h-full rounded-[var(--radius-clay-pill)]',
            'transition-all duration-500 ease-out',
            phase === 'complete' ? '' : isActive ? 'animate-pulse-soft' : '',
          ].join(' ')}
          style={{
            width: `${percentage}%`,
            backgroundColor:
              phase === 'complete'
                ? 'var(--color-clay-success)'
                : 'var(--color-clay-brand-teal)',
          }}
        />
      </div>

      {/* Status message */}
      {message && (
        <p className="text-body-sm text-clay-muted mt-2 truncate">
          {message}
        </p>
      )}
    </div>
  )
}
