import { useState } from 'react'
import { Button } from '../../../components/common/Button'
import { Alert } from '../../../components/common/Alert'
import { getErrorMessage } from '../../../utils/errors'
import type { PutawayScanEventApi } from '../types/putaway-api'

interface Props {
  label: string
  onScan: (code: string) => Promise<PutawayScanEventApi>
  disabled?: boolean
}

export function ScannerInput({ label, onScan, disabled = false }: Props) {
  const [code, setCode] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<PutawayScanEventApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    if (!code.trim() || isProcessing) return
    setIsProcessing(true)
    setError(null)
    try {
      const result = await onScan(code.trim())
      setLastResult(result)
      setCode('')
    } catch (scanError) {
      setLastResult(null)
      setError(getErrorMessage(scanError))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          placeholder={`Escanea o escribe ${label.toLowerCase()}...`}
          aria-label={label}
          className="flex-1 px-4 py-3 text-lg border rounded-lg"
          autoFocus
          disabled={disabled || isProcessing}
        />
        <Button onClick={handleScan} disabled={disabled || isProcessing || !code.trim()} className="px-6">
          {isProcessing ? '...' : 'Escanear'}
        </Button>
      </div>
      {lastResult && (
        <div className="text-sm text-green-700" role="status">
          ✓ {lastResult.normalized_code} — {lastResult.validation_status}
        </div>
      )}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  )
}
