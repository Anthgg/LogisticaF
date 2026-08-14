import { useState } from 'react'
import { Alert } from '../../../components/common/Alert'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { useMutation } from '../../inbound-docks/hooks/useQuery'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { useSensitiveActionGuard } from '../../logistics-permissions/hooks/useSensitiveActionGuard'
import { inboundInventoryDispositionApi } from '../api/inboundInventoryDispositionApi'
import type { InventoryDispositionSplit } from '../types/quarantine'

export interface SplitInventoryDispositionDialogProps {
  isOpen: boolean
  allocationId: string
  availableQuantity: string
  unitSymbol?: string
  onClose: () => void
  onSplitComplete: (result: InventoryDispositionSplit) => void
}

const SPLIT_TYPES = ['RELEASE', 'REJECTION', 'REINSPECTION'] as const
type SplitType = (typeof SPLIT_TYPES)[number]

export function SplitInventoryDispositionDialog({
  isOpen,
  allocationId,
  availableQuantity,
  unitSymbol = '',
  onClose,
  onSplitComplete,
}: SplitInventoryDispositionDialogProps) {
  const splitGuard = useSensitiveActionGuard({
    permission: LOGISTICS_PERMISSIONS.quarantine.splitAllocation,
    requiresReason: true,
  })
  const [quantity, setQuantity] = useState('')
  const [splitType, setSplitType] = useState<SplitType>('RELEASE')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const mutation = useMutation(
    (payload: Record<string, unknown>) => inboundInventoryDispositionApi.split(allocationId, payload),
    {
      onSuccess: (result) => {
        onSplitComplete(result)
        onClose()
      },
    },
  )

  if (!isOpen) return null

  const available = Number(availableQuantity)
  const requested = Number(quantity)
  const hasValidNumbers = Number.isFinite(available) && Number.isFinite(requested)
  const validQuantity = hasValidNumbers && requested > 0 && requested <= available
  const remaining = validQuantity ? available - requested : null
  const canSubmit = Boolean(allocationId && validQuantity && reason.trim() && confirmed && !splitGuard.stepUpRequired)

  const submit = async () => {
    if (!canSubmit) return
    const payload: Record<string, unknown> = {
      split_type: splitType,
      quantity: quantity.trim(),
      reason: reason.trim(),
    }
    const authorized = await splitGuard.run(async (guardReason) => {
      if (guardReason) payload.reason = guardReason
    })
    if (authorized) await mutation.mutate(payload)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => !mutation.isPending && onClose()}>
      <div className="dialog w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="split-disposition-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="split-disposition-title" className="text-base font-bold">Dividir disposición de inventario</h2>
        <p className="mt-2 text-xs text-slate-500">La previsualización se calcula localmente; al confirmar se envía el único POST publicado por el backend.</p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex justify-between"><span>Disponible</span><strong>{availableQuantity} {unitSymbol}</strong></div>
            <div className="mt-1 flex justify-between"><span>Saldo posterior</span><strong>{remaining === null ? 'Ingresa una cantidad válida' : `${remaining} ${unitSymbol}`}</strong></div>
          </div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="split-type">Destino</label>
          <select id="split-type" className="field__input text-xs" value={splitType} onChange={(event) => setSplitType(event.target.value as SplitType)}>
            {SPLIT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <Input id="split-quantity" label="Cantidad" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          {quantity && !validQuantity && <Alert variant="warning">La cantidad debe ser mayor que cero y no superar el saldo disponible.</Alert>}
          <Input id="split-reason" label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} required />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            Confirmo la división previsualizada.
          </label>
          {mutation.error && <Alert variant="error">{mutation.error}</Alert>}
          {splitGuard.errorMessage && <Alert variant="error">{splitGuard.errorMessage}</Alert>}
        </div>

        <div className="dialog__actions mt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button type="button" onClick={() => void submit()} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Confirmar división</Button>
        </div>
      </div>
    </div>
  )
}
