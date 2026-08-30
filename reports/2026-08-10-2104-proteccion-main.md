# Protección de `main`

## Configuración aplicada

- Protección activa en `main` y aplicada también a administradores.
- Pull request obligatorio antes de integrar cambios.
- Required status checks activos sin exigir que la rama esté actualizada con `main` (`strict: false`).
- Force pushes y eliminación de la rama bloqueados.
- Sin historial lineal, firmas, resolución de conversaciones, bloqueo de rama, restricciones de actores ni otras reglas adicionales.

## Required check exacto

- Contexto: `Lint, frontera protegida, pruebas y build`.
- Emisor restringido a GitHub Actions: `app_id: 15368` (`github-actions`).
- Workflow de origen verificado: `Gate rápido` (`.github/workflows/ci.yml`).

## Política de PR/bypass

- Se exige pull request, con `required_approving_review_count: 0`.
- No se exigen revisiones de CODEOWNERS, aprobación del último push ni descarte de revisiones anteriores.
- No hay bypass permanente configurado; `enforce_admins: true` aplica la protección a administradores.
- GitHub no ofrece en la protección clásica un bypass condicionado únicamente a una emergencia. Un administrador conserva la vía auditable de editar temporalmente la regla si una emergencia real lo requiere.

## Verificación final

- La API de ramas devuelve `protected: true` para `main`.
- Required check reconsultado: `Lint, frontera protegida, pruebas y build`, ligado a `app_id: 15368`.
- Política PR reconsultada: 0 aprobaciones requeridas y sin bypass allowances.
- `allow_force_pushes.enabled: false` y `allow_deletions.enabled: false`.
- `main` permanece en `f2af0b8df6cf9c5fdbc99582c05ee4d3a9167886`.
- El run `Gate rápido` 31453235980 y el job requerido 93661659965 permanecen `completed/success`.

## Limitaciones de permisos

- Ninguna. La autenticación disponible tiene permiso `ADMIN` sobre `klkmoraa/structureco` y la API aceptó la configuración.
