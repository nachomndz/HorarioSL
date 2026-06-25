# HorarioSL — Guía para el profesorado

**Colegio San Lorenzo · Cómo se configura y genera el horario escolar**

---

## ¿Qué es HorarioSL?

HorarioSL es una herramienta del colegio para **organizar el horario de todas las clases de forma automática**. No es una agenda personal: es el cuadrante oficial de **quién imparte qué asignatura, en qué curso y en qué franja horaria**.

La configuración la realiza normalmente **dirección o jefatura de estudios**. Lo que importa para cada profesor es **cómo está dado de alta en el sistema**, porque eso determina el horario que se genera.

---

## La idea en una frase

El programa necesita saber:

1. **Cuántas horas** hay que colocar en cada curso.
2. **En qué huecos** del día pueden ir las clases.
3. **Qué profesor** puede impartir cada asignatura y **cuándo no está disponible**.

Con esa información intenta montar el horario respetando los límites del centro y de cada docente.

---

## Los 7 pasos de configuración

### 1. Malla horaria — «¿Cómo es el día del cole?»

Se define la estructura de la jornada:

- Días lectivos (lunes a viernes, etc.)
- Hora de entrada y salida
- Recreos
- Cómo se divide el día en bloques horarios

**Para el profesorado:** esto marca **cuántos huecos** hay a la semana y **a qué horas** pueden caer las clases.

> **Importante:** si se cambia la malla, hay que **volver a revisar la disponibilidad** de los profesores.

---

### 2. Subciclos — «¿Qué cursos comparten el mismo currículo?»

En primaria, por ejemplo:

- 1.º + 2.º de Primaria  
- 3.º + 4.º de Primaria  
- 5.º + 6.º de Primaria  

Define qué horas obligatorias se aplican a cada grupo de cursos.

---

### 3. Currículo obligatorio — «¿Cuántas horas marca la ley?»

Tabla de **horas semanales por asignatura y subciclo**, según el currículo oficial (en Primaria, referencia Anexo IV).

También puede indicarse la **duración de cada clase** (45 min, 60 min, etc.).

**Para el profesorado:** es la referencia legal. Aún no es el horario definitivo; indica cuánto debería haber de cada materia por etapa.

---

### 4. Cursos — «¿Qué grupos hay en el centro?»

1.º A, 2.º B, 3.º C, etc. Cada curso se asigna a un subciclo.

**Para el profesorado:** son los **grupos** a los que se pueden asignar clases. Si impartes Matemáticas en 4.º A, en el horario aparecerá esa combinación: **curso + asignatura + profesor + hora**.

---

### 5. Asignaturas y horas por curso — «¿Cuántas horas reales tendrá cada grupo?»

Dos elementos:

1. **Lista de asignaturas** del centro (Lengua, Matemáticas, Inglés…)
2. **Matriz de horas**: para cada curso, cuántas horas semanales de cada asignatura

Puede rellenarse manualmente o copiarse desde el currículo («Aplicar a cursos»).

**Para el profesorado:** aquí se decide **cuántas sesiones** hay que colocar. Si 4.º A tiene 4 h de Lengua, el generador intentará programar **cuatro clases de Lengua para 4.º A** en la semana.

> El total de horas de un curso **no puede superar** los huecos que permite la malla horaria.

---

### 6. Profesores — «¿Quién puede dar qué y cuándo NO puede?»

Cada profesor del cuadrante se registra con:

| Dato | Significado práctico |
|------|----------------------|
| **Nombre** | Cómo aparece en el horario |
| **Asignaturas** | Qué puede impartir |
| **Ámbito** | Dónde puede dar clase: todo el centro, solo un ciclo o cursos concretos |
| **Horas máximas / semana** | Tope de horas lectivas semanales |
| **Disponibilidad** | Franjas en las que **NO** puede dar clase |

**Esta es la parte que más afecta a cada docente.** Si la ficha está incompleta o incorrecta:

- Puede no asignarse una asignatura que sí impartes → clases sin colocar.
- Si no se marca indisponibilidad (reuniones, reducción, otro centro) → pueden programarse clases en esas franjas.
- Si las horas máximas son incorrectas → el sistema no podrá completar la carga real.

---

### 7. Generar horario — «El ordenador monta el cuadrante»

Cuando la configuración está lista, se pulsa **Generar horario**. El programa:

1. Comprueba que no falten datos esenciales.
2. Calcula cuántas sesiones hay que colocar.
3. Intenta ubicarlas respetando:
   - asignaturas del profesor;
   - cursos en los que puede dar clase;
   - franjas bloqueadas;
   - horas máximas semanales;
   - que un curso no tenga dos clases a la vez;
   - que un profesor no esté en dos sitios a la vez.

Si no puede colocar todo, el horario queda **incompleto** y se indica qué ha quedado fuera y por qué.

Después se pueden hacer **ajustes manuales** y **exportar a Excel**.

---

## De «horas» a «clases en el horario»

No siempre 1 hora en la matriz = 1 casilla igual en el horario.

**Ejemplo:**

- 3 h semanales de Lengua con clases de **45 min** → 3 sesiones.
- 3 h con clases de **60 min** → 3 sesiones de 60 minutos.

El día se divide en **bloques pequeños** (por ejemplo, 15 minutos). Una clase de 45 min ocupa **3 bloques seguidos**; una de 60 min, **4 bloques**.

---

## Checklist: qué debe estar bien sobre cada profesor

1. Nombre correcto en la lista de profesores.  
2. Todas las asignaturas que imparte, marcadas.  
3. Ámbito correcto (si solo da Primaria, no «todo el colegio»).  
4. Horas máximas realistas (jornada completa, reducción, etc.).  
5. Disponibilidad actualizada tras cualquier cambio de malla.  
6. En la matriz, horas definidas para sus asignaturas en los cursos que imparte.  
7. Si comparte asignatura con otro compañero, que ambos estén dados de alta correctamente.

---

## Problemas frecuentes y causas habituales

| Lo que se nota | Causa habitual |
|----------------|----------------|
| Clase en horario de reunión o reducción | Indisponibilidad no marcada en la ficha |
| Falta una hora de una asignatura en un curso | No hay profesor habilitado o sin hueco disponible |
| Nombres genéricos («Prof. Mates») | Plantilla automática sin personalizar |
| Tras cambiar horarios del centro, restricciones incorrectas | Al cambiar la malla se resetea la disponibilidad |
| Demasiadas horas asignadas | Horas máximas mal configuradas o pocos profesores para repartir |

---

## Lo que el sistema NO hace

- No decide criterios pedagógicos (por ejemplo, Matemáticas por la mañana).
- No reparte automáticamente entre dos profesores de la misma asignatura («2 h cada uno»).
- No gestiona sustituciones, guardias ni asignación de aulas.
- No envía el horario individual a cada profesor por correo (se exporta o consulta desde la plataforma).

---

## Resumen del proceso

```
Malla horaria (jornada del cole)
           ↓
Cursos + horas por asignatura  →  «Hay que colocar X clases de Y en Z.º»
           ↓
Profesores + restricciones     →  «Solo estos pueden, y no en estas horas»
           ↓
GENERAR                        →  Cuadrante semanal
           ↓
Ajustes + Excel                →  Horario definitivo
```

---

## Datos que cada profesor debería facilitar al centro

**Nombre y apellidos:** _______________________________________________

**Asignaturas que imparte:** _______________________________________________

**Cursos / grupos:** _______________________________________________

**Horas máximas semanales:** _______________________________________________

**Franjas en las que NO puede dar clase** (reducción, coordinación, otro centro, etc.):

| Día | Franjas no disponibles |
|-----|------------------------|
| Lunes | |
| Martes | |
| Miércoles | |
| Jueves | |
| Viernes | |

**Observaciones:** _______________________________________________

---

*Documento generado para HorarioSL — Colegio San Lorenzo*
