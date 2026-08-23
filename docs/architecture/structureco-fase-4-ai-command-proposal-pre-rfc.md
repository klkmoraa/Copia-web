# Pre-RFC: IA acotada mediante CommandProposal

**Clasificación:** `REFERENCE`

**Fecha:** 2026-08-09
**Estado:** la mitad local del contrato está implementada en `src/ai/**` (esquema
cerrado v1, validador, allowlist, unidades, compilación sobre clon, diff y
confirmación). **Proveedor y transporte siguen sin implementarse**, y las
secciones de este documento que hablan de broker, adaptador y proveedor siguen
siendo propuesta. Ante cualquier discrepancia manda el código.
**Responsables del siguiente gate:** seguridad de aplicación + producto estructural

## 1. Decisión

- **HECHO:** structureCo ya dispone de `ProjectCommand`, patches reversibles, confirmación de ciertas operaciones y undo/redo.
- **HECHO:** `ExplanationAnchor` resuelve referencias internas a resultados almacenados, pero todavía no constituye un contrato portable/versionado completo para IA.
- **PROPUESTA:** una IA futura sólo puede proponer una operación cerrada. Nunca recibe acceso directo a `ProjectContext`, almacenamiento, workers, solver, herramientas o mutadores.
- **PROPUESTA:** DeepSeek sería un adaptador reemplazable detrás de un broker servidor; el contrato central permanece independiente del proveedor.
- **REQUIERE INVESTIGACIÓN:** privacidad, retención, residencia, términos, presupuesto, disponibilidad y evaluación del proveedor antes de enviar cualquier dato de proyecto.

Fase 4 no hace llamadas de red, no incorpora SDK, no almacena prompts y no introduce secretos.

## 2. Flujo futuro obligatorio

```text
intención del usuario
 -> contexto mínimo y redactado
 -> broker autenticado
 -> respuesta JSON del proveedor
 -> JSON Schema cerrado
 -> allowlist y conversión local de unidades
 -> compilación sobre clon del snapshot
 -> diff semántico visible
 -> confirmación exacta ligada a proposalId + snapshotHash
 -> executeProjectCommand
 -> una entrada de undo
```

Cualquier ambigüedad de ID, unidad, propiedad o intención termina en `needs-clarification` o `rejected`. La utilidad nunca relaja un control de seguridad.

## 3. JSON Schema normativo propuesto

El contrato usaría JSON Schema Draft 2020-12. `additionalProperties: false` se aplica en todos los objetos; la aplicación vuelve a validar localmente aunque el proveedor anuncie “JSON mode” o herramientas estrictas.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://structureco.local/schemas/command-proposal-v1.json",
  "title": "CommandProposalV1",
  "oneOf": [
    { "$ref": "#/$defs/ready" },
    { "$ref": "#/$defs/needsClarification" },
    { "$ref": "#/$defs/rejected" }
  ],
  "$defs": {
    "base": {
      "type": "object",
      "required": ["version", "proposalId", "snapshotHash", "status", "summary"],
      "properties": {
        "version": { "const": 1 },
        "proposalId": { "type": "string", "format": "uuid" },
        "snapshotHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "status": { "enum": ["ready", "needs-clarification", "rejected"] },
        "summary": { "type": "string", "minLength": 1, "maxLength": 240 }
      }
    },
    "quantity": {
      "type": "object",
      "additionalProperties": false,
      "required": ["value", "unit"],
      "properties": {
        "value": { "type": "number" },
        "unit": {
          "enum": ["Pa", "kPa", "MPa", "GPa", "psi", "ksi", "m2", "cm2", "mm2", "in2", "m4", "cm4", "mm4", "in4", "kg/m3", "lb/ft3"]
        }
      }
    },
    "createMember": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "nodeI", "nodeJ"],
      "properties": {
        "kind": { "const": "member.create-between-existing-nodes" },
        "nodeI": { "type": "string", "minLength": 1 },
        "nodeJ": { "type": "string", "minLength": 1 }
      }
    },
    "memberUpdates": {
      "type": "object",
      "additionalProperties": false,
      "minProperties": 1,
      "properties": {
        "label": { "type": "string", "minLength": 1, "maxLength": 120 },
        "E": { "$ref": "#/$defs/quantity" },
        "A": { "$ref": "#/$defs/quantity" },
        "I": { "$ref": "#/$defs/quantity" },
        "G": { "$ref": "#/$defs/quantity" },
        "shearArea": { "$ref": "#/$defs/quantity" },
        "density": { "$ref": "#/$defs/quantity" },
        "beamTheory": { "enum": ["euler-bernoulli", "timoshenko"] }
      }
    },
    "updateMember": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "memberId", "changes"],
      "properties": {
        "kind": { "const": "member.update-safe-properties" },
        "memberId": { "type": "string", "minLength": 1 },
        "changes": { "$ref": "#/$defs/memberUpdates" }
      }
    },
    "ready": {
      "allOf": [
        { "$ref": "#/$defs/base" },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["version", "proposalId", "snapshotHash", "status", "summary", "operation"],
          "properties": {
            "version": { "const": 1 },
            "proposalId": { "type": "string", "format": "uuid" },
            "snapshotHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
            "status": { "const": "ready" },
            "summary": { "type": "string", "minLength": 1, "maxLength": 240 },
            "operation": { "oneOf": [{ "$ref": "#/$defs/createMember" }, { "$ref": "#/$defs/updateMember" }] }
          }
        }
      ]
    },
    "needsClarification": {
      "type": "object",
      "additionalProperties": false,
      "required": ["version", "proposalId", "snapshotHash", "status", "summary", "questions"],
      "properties": {
        "version": { "const": 1 },
        "proposalId": { "type": "string", "format": "uuid" },
        "snapshotHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "status": { "const": "needs-clarification" },
        "summary": { "type": "string", "minLength": 1, "maxLength": 240 },
        "questions": { "type": "array", "minItems": 1, "maxItems": 3, "items": { "type": "string", "minLength": 1, "maxLength": 200 } }
      }
    },
    "rejected": {
      "type": "object",
      "additionalProperties": false,
      "required": ["version", "proposalId", "snapshotHash", "status", "summary", "reasonCode"],
      "properties": {
        "version": { "const": 1 },
        "proposalId": { "type": "string", "format": "uuid" },
        "snapshotHash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "status": { "const": "rejected" },
        "summary": { "type": "string", "minLength": 1, "maxLength": 240 },
        "reasonCode": { "enum": ["outside-allowlist", "ambiguous-id", "ambiguous-unit", "stale-snapshot", "unsafe-request", "invalid-output"] }
      }
    }
  }
}
```

Pseudotipo ilustrativo:

```ts
type CommandProposal =
  | { status: 'ready'; proposalId: string; snapshotHash: string; operation: SafeOperation }
  | { status: 'needs-clarification'; proposalId: string; snapshotHash: string; questions: readonly string[] }
  | { status: 'rejected'; proposalId: string; snapshotHash: string; reasonCode: RejectionCode };
```

## 4. Allowlist y prohibiciones

Una propuesta `ready` contiene exactamente una operación:

1. Crear una barra entre dos nodos existentes y distintos, usando defaults actuales mostrados en el preview.
2. Actualizar una barra existente sólo en `label`, `E`, `A`, `I`, `G`, `shearArea`, `density` o `beamTheory`.

Se rechazan nodos nuevos, borrar, cambiar extremos o tipo de barra, releases, resortes, offsets, cargas, apoyos, duplicación, DXF/importación, operaciones masivas, análisis, exportación y campos desconocidos. Los números siempre llegan como `{ value, unit }`; conversión, compatibilidad dimensional y redondeo de presentación son locales y deterministas.

## 5. Confirmación y enlace de acción

- El preview compila la operación sobre un clon del snapshot y muestra diff semántico, defaults materializados y unidades finales.
- Confirmar exige el mismo `proposalId`, `snapshotHash`, usuario/sesión y digest del diff mostrado.
- Cualquier cambio del proyecto invalida la propuesta; no se recompila silenciosamente contra el estado nuevo.
- Una confirmación ejecuta una única llamada a `executeProjectCommand` y produce una entrada de undo.
- Replay, doble click o respuesta tardía se rechazan con un nonce de un solo uso y expiración corta.

## 6. Broker futuro de DeepSeek

El navegador nunca contiene la clave de la empresa. Un broker servidor futuro deberá:

- autenticar usuario y autorización del proyecto;
- minimizar/redactar contexto antes de enviarlo;
- mantener la clave en un secret manager y rotarla;
- fijar modelo y parámetros permitidos del lado servidor;
- aplicar rate limit, presupuesto, concurrencia, timeout y tamaño máximo;
- validar JSON y schema antes de devolverlo;
- no persistir prompts, proyectos ni respuestas por defecto;
- registrar sólo métricas redactadas y eventos de seguridad;
- exponer kill switch global y por tenant;
- degradar a flujo manual cuando proveedor o broker no estén disponibles.

El modo JSON de un proveedor no sustituye validación de esquema, allowlist, snapshot binding ni confirmación humana.

## 7. Resultados y explicaciones

La IA no calcula ni interpreta resultados. Sólo puede citar un valor que provenga de un `ExplanationAnchor` oficial ligado a snapshot, combinación/caso, entidad, estación, componente, unidades y versión. Si el anchor no resuelve exactamente, la respuesta es `insufficient-evidence`; no se estima ni interpola.

## 8. Gates de seguridad y evaluación

| Gate | Criterio de bloqueo | Estado F4 |
|---|---|---|
| AI-G0 · contrato | Schema, allowlist, diff y binding revisados | Pre-RFC; no pasa implementación |
| AI-G1 · negativo | 0 operaciones prohibidas aceptadas en corpus adversarial | No existe harness |
| AI-G2 · consentimiento | 0 mutaciones sin confirmación exacta y vigente | No implementado |
| AI-G3 · ambigüedad | 100 % de IDs/unidades ambiguos fallan cerrados | No implementado |
| AI-G4 · resultados | 0 claims sin anchor oficial resoluble | Contrato parcial existente |
| AI-G5 · privacidad | 0 secretos cliente y 0 persistencia por defecto | Broker no existe |
| AI-G6 · operación | kill switch, límites, trazas redactadas y runbook probados | No implementado |
| AI-G7 · proveedor | privacidad/retención/términos/coste evaluados | Requiere investigación |

Una métrica de éxito útil se reportará separada de seguridad y nunca podrá compensar un fallo en AI-G1…AI-G7.

## 9. Fuentes primarias consultadas

- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html), consultado 2026-08-09.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) y [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf), consultados 2026-08-09.
- [JSON Schema — object/additionalProperties](https://json-schema.org/understanding-json-schema/reference/object), consultado 2026-08-09.
- [DeepSeek — JSON Output](https://api-docs.deepseek.com/guides/json_mode/) y [Chat Completion API](https://api-docs.deepseek.com/api/create-chat-completion), consultados 2026-08-09.
- [W3C PROV Primer](https://www.w3.org/TR/prov-primer/), consultado 2026-08-09.
