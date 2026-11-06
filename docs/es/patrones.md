# Patrones

Cada patrón trae el problema que resuelve, la regla, dónde lo implementa la referencia y lo que aprendimos operándolo en Morrigan Rook.

---

## 1. El agente propone, la persona aprueba

**Problema.** Un agente que puede enviar, firmar o decidir convierte cada error del modelo en un error frente al cliente, a velocidad de máquina.

**Regla.** Las salidas de los agentes son candidatos. Todo lo que pueda llegar a un cliente, a un prospecto o a un tercero espera a una persona. Aprobar es «esto lo firmo yo»; rechazar exige una nota.

**Referencia.** `tasks.ts` → `review()`. Solo un cargo de tipo `human` puede aprobar. Un rechazo sin nota se rechaza.

**Lección.** La nota de cada rechazo es el dato de entrenamiento más barato que va a tener. Léalas cada mes y corrija el agente, no la salida.

---

## 2. Los cargos como código

**Problema.** «¿Quién hace esto?» no tiene respuesta cuando los agentes son scripts sueltos. Nadie delega en algo sin nombre, sin jefe y sin límites.

**Regla.** Un archivo versionado lista cada puesto: humano o agente, jefe, estado (activo, vacante, en construcción, en pausa), lo que hace y lo que nunca hace. Los agentes tienen nombre humano y la marca de IA en todas partes.

**Referencia.** `team.ts` → `TEAM`, `syncTeam()`, `setRoleStatus()`.

**Lección.** Las decisiones tomadas en la aplicación deben sobrevivir a un despliegue. Al principio, cada despliegue reactivaba agentes que alguien había pausado. La solución: el archivo fija el estado solo la primera vez; si una persona lo cambia en la aplicación, gana la aplicación.

---

## 3. Compuertas, no recordatorios

**Problema.** «Nunca puntúe 4 sin evidencia» en una instrucción es un deseo. Bajo presión, modelos y personas toman atajos.

**Regla.** Si romper una regla le haría daño a un cliente o a la firma, el sistema lo impide: se niega a guardar, enviar o ejecutar, y dice por qué.

**Referencia.** `gates.ts` → `evidenceGate`, `privacyGate`, `outboundGate`.

**Lección.** Ponga primero en código los controles baratos y deterministas, y deje que un agente revise solo lo que pasa. Es más rápido, no cuesta nada, y el agente gasta su criterio en los casos difíciles.

---

## 4. Los datos nunca son órdenes

**Regla.** Lo externo entra a las instrucciones dentro de un bloque cercado y marcado, y las reglas permanentes del agente dicen que es material, no órdenes.

**Lección.** Cercar reduce el riesgo; no lo elimina. La protección real es estructural: un agente que no puede enviar, firmar ni decidir puede ser engañado sin consecuencias, porque su salida igual llega a una persona.

---

## 5. Versionado o no existe

**Regla.** Cada salida registra la versión del agente (un hash de su archivo de instrucciones) y el motor. Los cambios pasan por un banco de evaluación de casos cerrados antes de llegar a producción.

**Lección.** Un consultor que se equivoca, se equivoca con un cliente. Una instrucción mal calibrada se equivoca con todos a la vez y en la misma dirección, y nadie lo nota hasta que alguien lee dos casos lado a lado. Por eso el control de calidad es a ciegas y lo hace quien no condujo el caso.

---

## 6. Motores con tope y aislados

**Regla.** Los motores son intercambiables. Cada corrida recibe un entorno de lista blanca (sin llaves de API de pago, sin contraseñas de la base), una carpeta vacía y un tiempo límite. Cada motor tiene tope diario; al alcanzarlo, el trabajo espera a mañana. Una tarea a la vez.

**Lección.** Apague las funciones de comodidad de las CLI de agentes que usted no controla. Una memoria automática hizo que un agente intentara leer sus notas antes de responder, y devolvió ese intento en vez del JSON pedido. La memoria de la firma vive en la base de la firma.

---

## 7. La tasa de corrección humana

**Regla.** Mida, por agente, la proporción de salidas revisadas que una persona corrigió o rechazó. Entre 10 % y 25 % es sano. Por debajo, verifique que se esté revisando de verdad. Por encima, recalibre el agente.

---

## 8. Agentes honestos

**Regla.** Ningún agente dice ni insinúa ser una persona, y responde con la verdad si le preguntan. Donde la ley lo exige (por ejemplo, la obligación de transparencia del Reglamento Europeo de IA), se identifica como IA desde el inicio.

**Lección.** Los agentes de voz necesitan cuidado extra: un modelo puede escribir una llamada a una herramienta como texto y el motor de voz la lee en voz alta. Pruebe el cierre de la llamada con el mismo cuidado que el saludo.

---

## 9. El método en un solo lugar

**Regla.** Lo que es verdad (escalas, reglas, plantillas, obligaciones legales) vive en archivos compartidos del método. Lo que hay que hacer vive en cada agente. Los agentes citan el método; no lo copian.

---

## 10. La bitácora

**Regla.** Creación de tareas, bloqueos de compuertas, corridas (con versión, motor y duración), aprobaciones y rechazos (con nota) y cambios de cargo van a una bitácora a la que solo se agrega.

**Lección.** Cuando un cliente pregunte «¿de dónde salió esta cifra?», la respuesta debe costar una consulta, no una tarde.
