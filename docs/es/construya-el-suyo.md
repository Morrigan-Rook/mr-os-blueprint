# Construya el suyo

Un orden práctico para construir un sistema como MR OS en su organización. Supone un equipo pequeño y un servicio claro. Cada paso deja algo usable antes de empezar el siguiente.

1. **Escriba el método antes que el software.** Los agentes solo aplican criterios escritos con precisión: pasos, escalas, umbrales, qué cuenta como evidencia, qué lleva un buen entregable y qué se verifica antes de entregarlo. Si dos personas suyas puntuarían distinto el mismo caso, el método todavía no está listo para agentes.
2. **Liste los puestos.** El archivo de cargos: cada puesto humano y de agente, su jefe, lo que hace, lo que nunca hace y su estado. Incluya las vacantes. Nombre humano para los agentes y marca clara de IA.
3. **Decida qué aprueba una persona.** Toda salida que pueda llegar a un cliente, un prospecto o un tercero pasa por aprobación. Defina qué debe decir la nota de un rechazo.
4. **Convierta en compuertas las reglas que importan.** Empiece por: evidencia para las puntuaciones altas, datos de clientes solo con la cuenta formalmente abierta, mensajes salientes con opción de baja y sin cifras sin fuente, y ningún agente que diga ser persona.
5. **Defina los tipos de tarea.** Entrada, instrucción, formato de salida (JSON cuando la lee una máquina), validación y si requiere aprobación. Instrucciones en archivos versionados, una por agente; el método en archivos compartidos.
6. **Elija los motores con los ojos abiertos.** Qué motor hace qué nivel de trabajo, con qué modo de acceso y bajo qué términos. Aísle cada corrida, ponga topes diarios y trabaje de a una tarea hasta tener razones para no hacerlo.
7. **Construya la bandeja de aprobación.** Candidatos que se aprueban tal cual, con correcciones, o se rechazan con nota. Con la versión y el motor visibles en cada salida.
8. **Versione y evalúe.** Banco de casos cerrados antes de cambiar un agente; tasa de corrección por agente cada mes.
9. **Ponga el ritmo.** Brief diario, revisión semanal contra el plan (no contra la semana anterior) y revisión trimestral del método, los riesgos y los agentes. Un agente prepara; una persona conduce.
10. **Seguridad.** Llaves pegadas en la configuración por un administrador, nunca por chat ni en el código. Verificación en dos pasos para todos. Accesos por cargo, retirados el día en que alguien deja el cargo. Datos de clientes solo en herramientas autorizadas y con acuerdos de tratamiento. Ningún agente cambia sus propias reglas. Bitácora para decisiones y bloqueos.

## Qué medir desde el primer día

- Tasa de corrección por agente (sana: entre 10 % y 25 %).
- Bloqueos por compuerta por semana (una compuerta que nunca se activa quizá revisa lo que no es).
- Tiempo entre el disparador (una postulación, una respuesta) y el momento en que una persona ve el candidato.
- Proporción de salidas aprobadas sin cambios, por versión del agente.
