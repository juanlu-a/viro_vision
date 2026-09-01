# documents

Documentos fuente del proyecto: lo que se dibujó o se escribió fuera del repo y conviene versionar
tal cual, como registro de dónde salió una decisión.

No es donde se leen las cosas. La documentación viva está en [`../docs/`](../docs/) — acá va el
original, allá la versión mantenida.

| Archivo | Qué es |
|---|---|
| [`logicas-casos-de-uso.pdf`](logicas-casos-de-uso.pdf) | Diagrama de los tres flujos de reconocimiento, acordado por el equipo: dos variantes del caso ómnibus (modelo parcial o completo sobre la Raspi) y el caso supermercado (modelo en la nube). Transcrito a mermaid en [`../docs/architecture/README.md`](../docs/architecture/README.md#flujos-por-caso-de-uso), que es la **fuente canónica**: si los dos difieren, manda el mermaid. |

## Por qué el PDF y el mermaid conviven

El PDF es el artefacto original y prueba qué se acordó y cuándo; el mermaid es texto, se lee en un
diff, GitHub lo renderiza y se corrige sin volver a abrir la herramienta de dibujo. Duplicar tiene
un costo —pueden desincronizarse— y por eso está escrito cuál de los dos manda.
