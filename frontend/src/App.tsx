import { useState, useRef } from 'react'
import { Button } from './components/Button'
import { CustomSelect } from './components/CustomSelect'
import { CustomAutocomplete } from './components/CustomAutocomplete'
import { ProgressBar } from './components/ProgressBar'
import { LogViewer, type LogEntry } from './components/LogViewer'
import { ResultsView } from './components/ResultsView'

type ScrapedDoctor = Record<string, string>

function App() {
  const [location, setLocation] = useState('bangalore')
  const [specialty, setSpecialty] = useState('dentist')
  const [limit, setLimit] = useState<number | string>(50)

  const [isScraping, setIsScraping] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'discovery' | 'extraction' | 'complete'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [progressMessage, setProgressMessage] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [results, setResults] = useState<ScrapedDoctor[]>([])
  const [metadata, setMetadata] = useState<any>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const taskIdRef = useRef<string | null>(null)

  function addLog(text: string, level: LogEntry['level'] = 'info') {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLogs((prev) => [...prev, { text, level, timestamp }])
  }

  function determineLogLevel(data: any): LogEntry['level'] {
    if (data.type === 'error') return 'error'
    if (data.type === 'warning') return 'warning'
    if (data.message?.includes('Extracted')) return 'success'
    if (data.message?.includes('CAPTCHA')) return 'warning'
    if (data.message?.includes('RETRY')) return 'warning'
    if (data.message?.includes('FAILED')) return 'error'
    return 'info'
  }

  async function handleScrape() {
    setIsScraping(true)
    setLogs([])
    setResults([])
    setMetadata(null)
    setPhase('discovery')
    setProgress({ current: 0, total: 0 })
    setProgressMessage('')

    try {
      const res = await fetch('http://localhost:8000/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          specialty,
          limit: limit === 0 ? null : Number(limit),
        }),
      })
      const { task_id } = await res.json()
      taskIdRef.current = task_id

      const eventSource = new EventSource(
        `http://localhost:8000/api/stream/${task_id}`
      )
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const level = determineLogLevel(data)

        if (data.message) {
          addLog(data.message, level)
        }

        // Phase tracking (B10)
        if (data.phase) {
          setPhase(data.phase as any)
        }

        if (
          data.type === 'progress' &&
          data.current !== undefined &&
          data.total !== undefined
        ) {
          setProgress({ current: data.current, total: data.total })
          if (data.message) setProgressMessage(data.message)
        }

        if (data.type === 'done') {
          if (data.data) setResults(data.data)
          if (data.metadata) setMetadata(data.metadata)
          setPhase('complete')
          setIsScraping(false)
          eventSource.close()
          eventSourceRef.current = null
          taskIdRef.current = null
        }
      }

      eventSource.onerror = () => {
        addLog('Connection lost or closed.', 'warning')
        setIsScraping(false)
        setPhase('idle')
        eventSource.close()
        eventSourceRef.current = null
      }
    } catch {
      addLog('Could not start scraper. Is the backend running?', 'error')
      setIsScraping(false)
      setPhase('idle')
    }
  }

  async function handleCancel() {
    if (taskIdRef.current) {
      try {
        await fetch(`http://localhost:8000/api/cancel/${taskIdRef.current}`, {
          method: 'POST',
        })
        addLog('Cancellation requested...', 'warning')
      } catch {
        addLog('Could not send cancel request.', 'error')
      }
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsScraping(false)
    setPhase('idle')
    taskIdRef.current = null
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-clay-canvas)' }}>
      {/* ── Top Nav ── */}
      <nav
        className="sticky top-0 z-30 border-b border-clay-hairline"
        style={{
          backgroundColor: 'var(--color-clay-canvas)',
          height: '64px',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-[var(--radius-clay-md)] flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-clay-brand-teal)' }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="white"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <span className="text-title-sm text-clay-ink">Practo Scraper</span>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Sidebar: Configuration ── */}
          <div className="lg:col-span-4 space-y-6">
            <div
              className={[
                'border border-clay-hairline',
                'rounded-[var(--radius-clay-lg)] p-6',
              ].join(' ')}
              style={{ backgroundColor: 'var(--color-clay-canvas)' }}
            >
              <h2 className="text-title-md text-clay-ink mb-6">Configuration</h2>

              <div className="space-y-5">
                <CustomAutocomplete
                  label="Location"
                  placeholder="e.g. Bangalore"
                  endpoint="/api/autocomplete/location?"
                  value={location}
                  onChange={(v) => setLocation(v)}
                  disabled={isScraping}
                />

                <CustomAutocomplete
                  label="Specialty"
                  placeholder="e.g. Dentist"
                  endpoint={`/api/autocomplete/specialty?city=${encodeURIComponent(location)}`}
                  value={specialty}
                  onChange={(v) => setSpecialty(v)}
                  disabled={isScraping || !location}
                />

                <CustomSelect
                  label="Limit"
                  options={[
                    { label: 'Top 50', value: 50 },
                    { label: 'Top 100', value: 100 },
                    { label: 'Unlimited (max 500)', value: 0 },
                  ]}
                  value={limit}
                  onChange={(v) => setLimit(v)}
                  disabled={isScraping}
                />
              </div>

              <div className="mt-8 space-y-3">
                {!isScraping ? (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleScrape}
                    disabled={!location || !specialty}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Start Extraction
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={handleCancel}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="var(--color-clay-error)"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span style={{ color: 'var(--color-clay-error)' }}>
                      Cancel Scrape
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Main Area: Progress + Logs + Results ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Progress */}
            <div
              className={[
                'border border-clay-hairline',
                'rounded-[var(--radius-clay-lg)] p-6',
              ].join(' ')}
              style={{ backgroundColor: 'var(--color-clay-canvas)' }}
            >
              <ProgressBar
                current={progress.current}
                total={progress.total}
                phase={phase}
                message={progressMessage}
              />
            </div>

            {/* Log Viewer */}
            <LogViewer logs={logs} />

            {/* Results */}
            {phase === 'complete' && results.length > 0 && (
              <ResultsView
                results={results}
                metadata={metadata}
                location={location}
                specialty={specialty}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
