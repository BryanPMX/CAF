# Respuestas del director: constructoras y propiedades

**Respondió:** Jorge Pérez Sosa.

**Enviado:** 24 de noviembre de 2026, 18:46, hora de Denver.

**Estado:** enviado; 14 de 15 preguntas contestadas.

Esta transcripción se incorpora al repositorio por instrucción del responsable
del proyecto. Conserva las respuestas del cuestionario como evidencia de los
requisitos. Las afirmaciones sobre personas y empresas son información
proporcionada por el director; no constituyen una verificación de propiedad
actual ni autorizan a crear cuentas o modificar permisos por nombre.

## Cuestionario contestado

### 1. ¿Qué es lo más importante que necesita consultar en CAF?

- Los documentos y datos del Registro Público.
- Las propiedades de una persona.
- Los terrenos y fraccionamientos de una constructora.

### 2. Danos un ejemplo: ¿qué buscaría y qué le gustaría encontrar?

> Los datos de registro público y domicilio de una persona

### 3. Cuando dice que una persona “tiene constructora”, ¿qué situaciones necesitamos registrar?

- Trabaja por su cuenta con un nombre comercial.
- Es representante legal de una empresa.
- Es un contacto de la empresa.

### 4. Además de nombres y datos de contacto, ¿qué información le ha hecho falta?

> Edad que actualmente tiene y domicilio

### 5. ¿Hasta qué detalle necesita consultar las propiedades?

> También las manzanas y los lotes individuales

### 6. ¿Necesita consultar quiénes fueron los dueños anteriores?

> Sí, necesitamos ese historial

### 7. Además de Folio Real, Inscripción, Folio y Libro, ¿qué datos necesita tener a la mano?

- Ubicación, superficie y clave catastral.
- Fraccionamiento, manzana y lote.

### 8. ¿Vamos a registrar propiedades fuera del distrito Bravos?

> Sí, de otros distritos de Chihuahua

### 9. ¿Cuánta información tienen y dónde está guardada?

> En documento Word

No indicó una cantidad de personas o propiedades.

### 10. ¿Quién concentrará la información y quién debe poder consultarla?

- Jorge Pérez Sosa.
- Jorge Manuel Pérez Armendáriz.
- Yesica Yuliana Pérez Armendáriz.

No especificó restricciones adicionales ni identificadores de cuentas. Los
permisos vigentes por rol y oficina continúan siendo la regla de acceso.

### 11. ¿Qué debe quedar resuelto primero para que esto ya le sea útil?

**Sin responder.** No se inventó una prioridad en nombre del director.

### 12. ¿“Granjas Santa Elena” es el nombre del fraccionamiento, de la empresa o de ambos?

> Del fraccionamiento

### 13. En la primera imagen aparece Elena Rojo. ¿Qué relación tiene con la constructora y cómo se llama esa empresa?

> Elena Rojo es la propietaria de la constructora, fraccionamiento Santa Elena Elena

Se conserva la redacción original. La respuesta no identifica inequívocamente
la razón social de la empresa y no confirma quién es el propietario actual del
terreno que aparece en la inscripción histórica.

### 14. La ubicación “kilómetro 27, al sur de la ciudad”, ¿a qué corresponde?

> A otras propiedades de esa persona

No debe asignarse esa ubicación automáticamente al terreno de la primera imagen.

### 15. ¿Cómo se llama la constructora de Francisco Yepo Yong y qué relación tiene él con ella?

> Ninguna .
> Él tiene otras fraccionadoras en diferente lugar de la ciudad

No proporcionó nombres de las otras empresas. No se crea una relación con Granjas
Santa Elena ni con la primera persona a partir de esta respuesta.

## Correspondencia con la implementación

| Necesidad confirmada | Implementación o tratamiento |
| --- | --- |
| Consultar información registral y propiedades de una persona | Archivo de propiedades, búsqueda, perfil del cliente y registros repetibles |
| Distintas relaciones con una constructora | Roles explícitos y múltiples: por cuenta propia, representante, contacto, propietario o socio |
| Edad y domicilio | Fecha de nacimiento opcional para calcular edad; domicilio personal visible en el perfil administrado |
| Manzanas y lotes | Tipos terreno/manzana/lote y relación con la propiedad de origen |
| Dueños anteriores | Historial de titularidad con estado, fechas, porcentaje y fuente |
| Identificadores del Registro Público | Folio Real, Inscripción, Folio, Libro y Sección separados; texto que conserva ceros iniciales |
| Datos del inmueble | Ubicación, superficie en m²/ha, clave catastral, fraccionamiento, manzana y lote |
| Otros distritos de Chihuahua | Estado, municipio y distrito editables; Bravos es solo un valor inicial |
| Información en Word | Documentos de respaldo adjuntos; captura manual, sin extracción o importación automática |
| Personas responsables | Se documentan los nombres; no se conceden permisos automáticamente |
| Granjas Santa Elena | Campo de fraccionamiento independiente de los nombres de la empresa |
| Kilómetro 27 | Se conserva como aclaración; no se asigna a una propiedad sin confirmación |
| Otras fraccionadoras | Se permiten registros y relaciones independientes; nombres pendientes de confirmar |

La captura de una edad informada sin fecha de nacimiento, la edición nativa en
Flutter y la extracción automática desde Word no forman parte de esta versión.
El alcance, los permisos y el despliegue están descritos en
[Archivo de propiedades](../PROPERTY_ARCHIVE.md).
