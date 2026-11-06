# MR OS Blueprint

**Cómo operar una firma donde personas y agentes de inteligencia artificial trabajan juntos, sin perder el control de lo que sale por la puerta.**

[Read in English](README.md)

MR OS es el sistema operativo interno de [Morrigan Rook](https://morriganrook.com), una consultora de negocio. Un equipo senior pequeño trabaja con algunas decenas de agentes de IA: los agentes levantan, analizan y redactan; las personas juzgan, deciden y firman. Este repositorio es el plano público de ese sistema: los principios, la arquitectura, los patrones y una implementación de referencia pequeña que se ejecuta en un minuto.

No es MR OS. Aquí no hay datos de clientes, ni precios, ni contratos, ni las instrucciones de nuestros agentes. Sí están la arquitectura, las reglas y el código que las hace cumplir.

---

## Las ideas en una página

1. **El agente propone, la persona aprueba.** Toda salida de un agente es un *candidato*. Aprobar significa «esto lo firmo yo». Rechazar exige una nota que diga qué estaba mal.
2. **Los cargos como código.** Cada puesto de la firma, humano o de IA, es un cargo con jefe, una lista escrita de lo que hace y de lo que nunca hace, y un estado. Los puestos vacíos existen como vacantes, para que el trabajo tenga dueño desde el primer día.
3. **Compuertas, no recordatorios.** Una instrucción le puede pedir a un agente que se porte bien. Una compuerta hace imposible guardar, enviar o ejecutar lo indebido.
4. **Los datos nunca son órdenes.** Correos, postulaciones y documentos son material de trabajo. Todo lo externo va encerrado y marcado como dato.
5. **Versionado o no existe.** Cada salida registra la versión exacta del agente y el motor que la produjo.
6. **Motores con tope y aislados.** Los agentes trabajan de a uno, con tope diario, en un entorno que nunca recibe llaves de API de pago ni los secretos del servidor.
7. **Vigilar la tasa de corrección humana.** Entre el 10 % y el 25 % de las salidas deberían necesitar corrección. Por debajo, probablemente se dejó de revisar; por encima, hay que recalibrar el agente en lugar de corregirlo a mano para siempre.
8. **Los agentes tienen nombre, nunca disfraz.** Un nombre humano hace natural el trabajo en equipo. Los agentes llevan la marca de IA en todas partes y nunca dicen ser personas.
9. **El método vive en un solo lugar.** Escalas, reglas y plantillas se escriben una vez y todos los agentes las usan. Cambiar el método es una edición, no diez.
10. **Todo deja rastro.** Decisiones, aprobaciones, rechazos y bloqueos de compuertas van a una bitácora a la que solo se agrega.

## Arquitectura

El diagrama está en el [README en inglés](README.md#architecture). En corto: lo que entra (formularios, correos, disparadores de tiempo) crea tareas; cada tarea pasa por las compuertas; el trabajador ejecuta una a la vez con un motor aislado y con tope; el resultado llega como candidato a una persona; la persona aprueba o rechaza con nota; todo queda en la bitácora; solo lo aprobado sale hacia el cliente.

El sistema en producción agrega una aplicación web para las personas (aprobaciones, tableros, el método paso a paso), integraciones con las herramientas de la firma, un motor de documentos con plantillas legales versionadas y un flujo de despliegue. Los patrones son los mismos.

## Ejecutar la referencia

Requiere Node.js 22.13 o superior. No hay dependencias que instalar.

```bash
npm run demo   # un recorrido con una firma ficticia y un motor simulado
npm test       # las reglas, como pruebas
```

## Qué hay adentro

| Ruta | Qué muestra |
|---|---|
| `reference/src/team.ts` | Los cargos como código, y una sincronización que nunca deshace una decisión tomada en la aplicación |
| `reference/src/tasks.ts` | Tipos de tarea, ciclo de vida, aprobación con nota y tasa de corrección |
| `reference/src/gates.ts` | Compuertas de evidencia, privacidad y mensajes salientes |
| `reference/src/engines.ts` | Motores intercambiables, entorno de lista blanca y topes diarios |
| `reference/src/untrusted.ts` | Encerrar datos externos y recuperar JSON de las respuestas |
| `reference/src/versioning.ts` | Versiones automáticas a partir de las instrucciones |
| `reference/src/worker.ts` | El trabajador de a una tarea |
| `docs/es/patrones.md` | Cada patrón en detalle, con lecciones de producción |
| `docs/es/construya-el-suyo.md` | Guía paso a paso para construir un sistema similar |

## Sobre los motores y los términos de los proveedores

La referencia trae un motor simulado y un adaptador genérico de línea de comandos. MR OS ejecuta sus agentes con las CLI oficiales de los proveedores de IA y las suscripciones de la firma, de a una tarea y con topes diarios, en lugar de APIs de pago por consumo. Si construye algo similar, lea los términos vigentes de cada proveedor para el modo de acceso que elija: cambian con el tiempo y no son iguales entre proveedores.

## Licencia y atribución

Licencia Apache 2.0. Puede usar, modificar y distribuir este trabajo, también con fines comerciales, conservando el archivo [NOTICE](NOTICE), que reconoce a Morrigan Rook como origen. La licencia no otorga derechos sobre los nombres ni los logos de Morrigan Rook y MR OS.

Construido y mantenido por [Morrigan Rook](https://morriganrook.com).
