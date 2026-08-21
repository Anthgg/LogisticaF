# Gates de permiso en la interfaz

`PermissionGate` decide si un elemento se muestra, se muestra inhabilitado o no se
muestra.

```tsx
<PermissionGate permission={LOGISTICS_PERMISSIONS.warehouses.create}>
  <button>Nuevo almacén</button>
</PermissionGate>
```

| Prop | Efecto |
|---|---|
| `permission` | exige un código |
| `anyOf` | basta uno de la lista |
| `allOf` | exige todos |
| `scope` | además, alcance territorial (organización / sucursal / almacén) |
| `mode` | `hide` (por defecto) o `disable` |
| `disabledReason` | texto del `title` cuando `mode="disable"` |
| `fallback` | qué renderizar en lugar del contenido |

La decisión se expone como `GateDecision` con motivo: `loading`, `denied`, `scope` o
`authorized`. Durante `loading` no renderiza nada — ni el contenido ni el fallback — para
que un botón no aparezca y desaparezca mientras llegan los permisos.

`mode="disable"` es preferible cuando esconder el control confundiría (una acción que el
usuario espera encontrar); `hide` cuando la acción no forma parte de su trabajo.

## Lo que un gate no es

Un gate no protege nada: solo evita ofrecer una acción que va a acabar en 403. La
autorización real la aplica el backend en cada endpoint. Si un gate y el backend
discrepan, el que está mal es el gate — y desde esta PR hay un trinquete en CI que
detecta la forma más común de discrepancia, exigir un permiso que no existe
(ver [permission-contract-drift.md](permission-contract-drift.md)).
