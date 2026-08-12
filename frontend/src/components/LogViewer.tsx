import { useEffect, useRef } from 'react'

export type LogEntry = {
  text: string
  level: 'info' | 'warning' | 'error' | 'success'
  timestamp: string
}

interface LogViewerProps {
  logs: LogEntry[]
  maxHeight?: number
}

const levelColors: Record<string, string> = {
  info: 'var(--color-clay-body)',
  warning: 'var(--color-clay-warning)',
  error: 'var(--color-clay-error)',
  success: 'var(--color-clay-success)',
}

const levelPrefixes: Record<string, string> = {
  info: '',
  warning: 'WARNING',
  error: 'ERROR',
  success: '',
}

export function LogViewer({ logs, maxHeight = 420 }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div
      className={[
        'relative w-full',
        'bg-clay-surface-soft border border-clay-hairline',
        'rounded-[var(--radius-clay-lg)]',
        'overflow-hidden',
      ].join(' ')}
    >
      {/* Header */}
      <div
        className={[
          'flex items-center gap-2 px-4 py-3',
          'border-b border-clay-hairline',
          'bg-clay-surface-card',
        ].join(' ')}
      >
        <svg
          className="w-4 h-4 text-clay-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <span className="text-caption font-medium text-clay-muted">Activity Log</span>
        <span className="ml-auto text-caption text-clay-muted-soft">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Log content — custom scrollbar, NO native scrollbar */}
      <div
        ref={containerRef}
        className="overflow-y-auto hide-scrollbar relative"
        style={{ maxHeight }}
      >
        {/* Scroll shadow at top */}
        <div
          className="sticky top-0 left-0 right-0 h-4 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, var(--color-clay-surface-soft), transparent)',
          }}
        />

        {logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-clay-muted-soft text-body-sm">
            Waiting for scrape to start...
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-1">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex gap-2 text-body-sm animate-fade-in"
                style={{ color: levelColors[log.level] || levelColors.info }}
              >
                <span className="text-clay-muted-soft shrink-0 text-caption tabular-nums">
                  {log.timestamp}
                </span>
                {levelPrefixes[log.level] && (
                  <span
                    className={[
                      'shrink-0 text-caption-uppercase px-1.5 py-0.5',
                      'rounded-[var(--radius-clay-xs)]',
                      log.level === 'error'
                        ? 'bg-clay-error/10'
                        : log.level === 'warning'
                          ? 'bg-clay-warning/10'
                          : '',
                    ].join(' ')}
                  >
                    {levelPrefixes[log.level]}
                  </span>
                )}
                <span className="break-words min-w-0">{log.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Scroll shadow at bottom */}
        <div
          className="sticky bottom-0 left-0 right-0 h-4 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, var(--color-clay-surface-soft), transparent)',
          }}
        />
      </div>
    </div>
  )
}
