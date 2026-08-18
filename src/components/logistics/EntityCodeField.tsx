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
        <p className="field__readonly">
          <code>{code}</code>
        </p>
      ) : (
        <p className="field__hint">Se generará automáticamente</p>
      )}
    </div>
  )
}
