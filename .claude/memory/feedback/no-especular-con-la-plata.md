# No especular cuando se paga plata con eso

Sesión del 2026-08-20/21. Jen frenó una cuenta de cobro con la pregunta correcta:

> *"tú no tienes cómo saber qué paquetes despachó Daniel, porque ni estaba construida la app,
> entonces ¿de dónde sacas que esto es de ahí?"*

Tenía razón. De los 28 envíos de Galerías solo 9 quedaron registrados al despachar; los otros 19
se asignaron en bloque por SQL el 18-ago **deduciendo la bodega por el canal**. Y esa deducción ya
había fallado: seis envíos de agencia estaban cargados a Gina siendo de Daniel. La cuenta los
presentaba a todos con la misma cara, como si fueran un registro de lo que pasó.

Su instrucción, textual:

> *"no quiero que especules, cuenta los 24, di que no sabes a qué paquetes corresponde, y ya de
> ahí en adelante sí que sea lo real"*

**La regla:** cuando un dato salga de una inferencia y no de un registro, la pantalla tiene que
decirlo — y si con eso se paga plata, no se cuenta: se pide la cuenta de la bodega. Presentar una
deducción con la misma cara que un hecho es como se cuela un error que nadie puede detectar
después.

**Pero no todas las inferencias son iguales**, y ella lo corrigió enseguida: *"daniel y gina son
diferentes, tenemos todo agosto de gina"*. Los 8 envíos deducidos de Gina son **todos Flex**, y
solo ella hace Flex — ahí no hay ambigüedad. Los 18 de Daniel son todos agencia, que hacen los
dos. De ahí salió `isAttributionCertain`.

## El patrón que se repitió toda la sesión

Cuatro veces un dato mío heredado resultó falso y ella lo corrigió: el inventario inflado, la
bolsa de más, los $120.000 de Daniel, y el envío de octubre de 2025. **En los cuatro casos repetí
una nota vieja sin verificarla, y en los cuatro el sistema tenía razón.**

Un pendiente heredado se verifica antes de volver a mencionarlo. Y cuando ella pregunta *"¿de
dónde sacas eso?"*, la respuesta correcta casi nunca es defender el número.

## Corolario sobre la UI

Un total agregado no se puede verificar. Ella vio "Otros conceptos $20.000" y no tenía forma de
saber qué había adentro (eran dos cosas distintas, una ya pagada). **Cada línea de plata tiene que
poder rastrearse hasta su origen sin abrir nada** — y al revés, lo ya saldado desaparece en vez de
aparecer y luego restarse.

Relacionado: [[verificar-contra-la-ui-real]], [[../project/logistica-reglas-reales]].
