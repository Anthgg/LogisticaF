/**
 * Muestra el código de una entidad (F005.1).
 *
 * El código lo genera el backend, así que nunca hay un input editable. En alta se
 * anuncia que se generará; en edición se muestra el valor real, solo lectura.
 *
 * Deliberadamente no es un `<input disabled>`: un campo con aspecto de formulario
 * invita a intentar escribir en él. Es metadato, y se presenta como tal.
 */
export function EntityCodeField({
  code,
  label = 'Código',
}: {
  /** `null` en alta: todavía no existe. */
  code?: string | null
  label?: string
}) {
  return (
    <div className="field" data-testid="entity-code-field">
      <span className="field__label">{label}</span>
      {code ? (
        <div className="field__readonly">
          <code>{code}</code>
        </div>
      ) : (
        <div className="flex h-9 items-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-3 text-xs text-slate-400 italic">
          Se generará automáticamente
        </div>
      )}
    </div>
  )
}
