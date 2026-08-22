# CRI-106 · Pre-flight de lector de pantalla real

Verificado en el entorno de ejecución de esta sesión (contenedor Linux headless, sin sesión de escritorio):

```
$ which orca            → (vacío, no encontrado)
$ which nvda             → (vacío, no encontrado)
$ which jaws             → (vacío, no encontrado)
$ which spd-say          → (vacío, no encontrado — sin speech-dispatcher)
$ which at-spi2-registryd → (vacío, no encontrado)
$ echo $DISPLAY           → (vacío, sin servidor X)
$ uname -a
Linux vm 6.18.5-fc-v20 #1 SMP PREEMPT_DYNAMIC ... x86_64 GNU/Linux
$ ps aux | grep -iE "orca|speech|accessib"  → sin procesos
```

## Veredicto

No existe en este entorno ningún lector de pantalla REAL (VoiceOver requiere macOS; NVDA/JAWS requieren Windows; Orca requiere una sesión de escritorio Linux con `at-spi2` y salida de audio, ninguna disponible en un contenedor headless sin `$DISPLAY`).

Por regla explícita de CRI-106 §4: *"Si NO existe... al menos un lector de pantalla REAL... NO inventes cumplimiento... CRI-106 debe quedar BLOCKED y no Done."*

**No se simuló ningún lector de pantalla como sustituto.** Lo que sí se hizo, y se declara explícitamente como NO equivalente a una pasada real:

- Inventario estático de regiones `aria-live` por `grep` (ver `../aria-live-static-inventory.md`).
- Lectura de código de los componentes con foco/aria-live/D-14 (`AnalysisStatus.tsx`, `TopBar.tsx`) para verificar INTENCIÓN, no comportamiento real de locución.
- Recorrido de foco por teclado real en Chromium (`../focus/focus-walkthrough.json`), que verifica alcanzabilidad y restauración de foco, pero NO verifica qué anuncia un lector de pantalla ni si hay locución duplicada.

Ninguno de estos tres sustituye la pasada real que exige CRI-106 §8/§9. **Este es el motivo primario del veredicto BLOCKED.**
