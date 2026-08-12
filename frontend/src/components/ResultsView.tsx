import { useState } from 'react'
import { Button } from './Button'

type ScrapedDoctor = Record<string, string>

interface ResultsViewProps {
  results: ScrapedDoctor[]
  metadata?: {
    timestamp?: string
    location?: string
    specialty?: string
    limit_requested?: number | null
    total_found?: number
    total_scraped?: number
    total_failed?: number
    total_skipped_dedup?: number
    failed_urls?: string[]
    warnings?: string[]
  }
  location: string
  specialty: string
}

const VISIBLE_FIELDS = [
  'Full Name',
  'Primary Specialty',
  'Hospital/Clinic Name',
  'City',
  'Years of Experience',
  'Education',
  'Mobile Number',
]

export function ResultsView({ results, metadata, location, specialty }: ResultsViewProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  function exportCSV() {
    if (results.length === 0) return

    const allFields = Object.keys(results[0])
    const metaLines = metadata
      ? [
          `# Practo Scrape Export`,
          `# Timestamp: ${metadata.timestamp || 'N/A'}`,
          `# Location: ${metadata.location || location}`,
          `# Specialty: ${metadata.specialty || specialty}`,
          `# Requested: ${metadata.limit_requested || 'Unlimited'}`,
          `# Found: ${metadata.total_found || 0}`,
          `# Scraped: ${metadata.total_scraped || 0}`,
          `# Failed: ${metadata.total_failed || 0}`,
          '',
        ]
      : []

    const csvContent = [
      ...metaLines,
      allFields.join(','),
      ...results.map((row) =>
        allFields
          .map((field) => {
            const val = row[field] || ''
            return `"${val.toString().replace(/"/g, '""')}"`
          })
          .join(',')
      ),
    ].join('\n')

    downloadBlob(csvContent, 'text/csv;charset=utf-8;', `practo_${location}_${specialty}.csv`)
  }

  function exportJSON() {
    if (results.length === 0) return
    const exportData = {
      metadata: metadata || { location, specialty },
      data: results,
    }
    const content = JSON.stringify(exportData, null, 2)
    downloadBlob(content, 'application/json', `practo_${location}_${specialty}.json`)
  }

  function exportMD() {
    if (results.length === 0) return
    const allFields = Object.keys(results[0])

    const metaBlock = metadata
      ? [
          `# Practo Scrape: ${metadata.specialty || specialty} in ${metadata.location || location}`,
          '',
          `- **Date:** ${metadata.timestamp || 'N/A'}`,
          `- **Requested:** ${metadata.limit_requested || 'Unlimited'}`,
          `- **Found:** ${metadata.total_found || 0}`,
          `- **Scraped:** ${metadata.total_scraped || 0}`,
          `- **Failed:** ${metadata.total_failed || 0}`,
          '',
        ]
      : []

    const mdContent = [
      ...metaBlock,
      `| ${allFields.join(' | ')} |`,
      `| ${allFields.map(() => '---').join(' | ')} |`,
      ...results.map(
        (row) =>
          `| ${allFields
            .map((field) => {
              const val = row[field] || ''
              return val.toString().replace(/\|/g, '\\|').replace(/\n/g, ' ')
            })
            .join(' | ')} |`
      ),
    ].join('\n')

    downloadBlob(mdContent, 'text/markdown', `practo_${location}_${specialty}.md`)
  }

  function downloadBlob(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (results.length === 0) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary card */}
      <div
        className={[
          'bg-clay-surface-soft border border-clay-hairline',
          'rounded-[var(--radius-clay-lg)] p-6',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-[var(--radius-clay-md)] flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-clay-success)', color: 'white' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-title-sm text-clay-ink">Extraction Complete</h3>
            <p className="text-body-sm text-clay-muted">
              {results.length} profiles extracted
              {metadata?.total_failed ? ` (${metadata.total_failed} failed)` : ''}
            </p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportCSV}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={exportJSON}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export JSON
          </Button>
          <Button variant="secondary" onClick={exportMD}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Markdown
          </Button>
        </div>
      </div>

      {/* Results table */}
      <div
        className={[
          'bg-clay-canvas border border-clay-hairline',
          'rounded-[var(--radius-clay-lg)]',
          'overflow-hidden',
        ].join(' ')}
      >
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-clay-hairline bg-clay-surface-card">
                <th className="px-4 py-3 text-caption-uppercase text-clay-muted w-10">#</th>
                {VISIBLE_FIELDS.map((field) => (
                  <th
                    key={field}
                    className="px-4 py-3 text-caption-uppercase text-clay-muted whitespace-nowrap"
                  >
                    {field}
                  </th>
                ))}
                <th className="px-4 py-3 text-caption-uppercase text-clay-muted">Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((doc, i) => (
                <>
                  <tr
                    key={i}
                    className={[
                      'border-b border-clay-hairline-soft',
                      'transition-colors duration-100',
                      'hover:bg-clay-surface-soft',
                      expandedRow === i ? 'bg-clay-surface-soft' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-caption text-clay-muted-soft">{i + 1}</td>
                    {VISIBLE_FIELDS.map((field) => (
                      <td
                        key={field}
                        className="px-4 py-3 text-body-sm text-clay-body max-w-[200px] truncate"
                        title={doc[field] || 'N/A'}
                      >
                        {doc[field] || 'N/A'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                        className={[
                          'text-caption text-clay-muted',
                          'hover:text-clay-ink transition-colors',
                          'cursor-pointer bg-transparent border-none p-1',
                        ].join(' ')}
                      >
                        {expandedRow === i ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedRow === i && (
                    <tr key={`${i}-detail`}>
                      <td colSpan={VISIBLE_FIELDS.length + 2} className="px-4 py-4 bg-clay-surface-soft">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(doc).map(([key, val]) => (
                            <div key={key} className="flex flex-col">
                              <span className="text-caption text-clay-muted">{key}</span>
                              <span className="text-body-sm text-clay-ink break-words">
                                {val || 'Not Available'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
