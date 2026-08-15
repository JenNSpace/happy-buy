# Conectores de claude.ai (Google Drive, etc.) no aparecen solos en una sesión ya abierta

El usuario tiene Google Drive conectado en claude.ai (Settings →
Connectors, con check verde, confirmado por captura de pantalla) — de ahí
salía el acceso a Drive que existió en una sesión anterior de este mismo
proyecto (herramienta `mcp__claude_ai_Google_Drive__read_file_content`).

En una sesión nueva de Claude Code (extensión de VS Code), ese conector
**no apareció disponible** aunque llevaba activo en la cuenta desde antes
("siempre lo estuvo", palabras del usuario). Buscarlo de nuevo a mitad de
la MISMA sesión (`ToolSearch`) tampoco lo hace aparecer — la lista de
herramientas de una sesión de Claude Code parece fijarse al arrancar, no
se refresca sola cuando algo cambia del lado de la cuenta.

**Fix:** cerrar y volver a abrir la extensión de Claude Code en VS Code (o
recargar la ventana) y empezar una conversación nueva. No hay nada que
Claude pueda hacer desde dentro de una sesión ya corriendo para forzar ese
refresco — ni editando `.mcp.json` (ese archivo es para MCP servers
propios del proyecto, no para conectores de cuenta de claude.ai) ni de
ninguna otra forma encontrada.

No confirmado con certeza total: si el sync entre "conector activo en
claude.ai" y "disponible en Claude Code" es automático tras reiniciar, o
si puede necesitar un paso adicional. Si el reinicio no alcanza, el
siguiente punto a revisar sería soporte de Anthropic, no config local.
