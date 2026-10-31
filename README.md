# AnimeAV1 para Mangayomi — experimental

Extensión JavaScript real (`DefaultExtension extends MProvider`) con catálogo,
búsqueda, fichas, episodios y conexión a los extractores de Mangayomi.
Usa la API no oficial de ahmedrangel; no requiere claves ni un servidor propio.

## Agregar el catálogo

En Mangayomi, abrí la configuración de repositorios de **Anime** (la ubicación
puede variar según la versión) y agregá esta URL completa, incluido el punto
después de `mangayomi-animeav1`:

```text
https://raw.githubusercontent.com/marblingdesing-ai/mangayomi-animeav1./main/anime_index.json
```

Actualizá el catálogo, buscá **AnimeAV1** en español e instalá la extensión.
Este procedimiento y la instalación todavía no fueron comprobados dentro de
Mangayomi ni en Onn TV. No hace falta activar GitHub Pages.

## Alcance y límites

### Corrección de portadas — 0.1.1

Las tarjetas de catálogo y búsqueda convierten únicamente la ruta conocida
`https://cdn.animeav1.com/thumbnails/` a `/covers/`, conservando el identificador
y el resto de la URL. Es la misma ruta de portada que entrega la ficha del anime.
Las portadas que ya llegan con `/covers/` se conservan. No se hace ninguna
consulta extra por tarjeta ni se descargan fichas para construir el catálogo.

Validación del cambio: **10 pruebas locales aprobadas**, incluidas búsquedas,
episodios y extractores simulados. Se compararon tres novedades reales (Keroro
Gunsou, Tokyo Revengers: Santen Sensou-hen y Uchi no Otouto-domo ga Sumimasen):
las URLs normalizadas coincidieron exactamente con `cover` de sus fichas y las
tres imágenes respondieron HTTP 200 con tipo `image/jpeg`. La búsqueda real de
`naruto` ya devuelve imágenes de `/covers/`.

Actualizá el catálogo y la extensión a **0.1.1**. Si Mangayomi conserva tarjetas
anteriores, volvé a cargar la lista; podría ser necesario limpiar su caché de
imágenes. La visualización dentro de Mangayomi TV queda por confirmar en el
dispositivo. Esta corrección no cambia la resolución de servidores de video.

- Explorar muestra los últimos animes actualizados, sin ranking de popularidad.
- Novedades elimina episodios repetidos del mismo anime y no inventa paginación.
- Búsqueda usa la paginación de la API. Fichas incluyen sinopsis, géneros,
  estado y episodios ordenados de mayor a menor; no se inventan fechas.
- Video delega en `voeExtractor` y `mp4UploadExtractor`, incluidos en Mangayomi.
  Un servidor que falla no impide intentar el siguiente. Se conservan las
  cabeceras y pistas devueltas por el extractor y se deduplican los videos.
- Las páginas embed **no** se devuelven como si fueran archivos reproducibles.
  HLS/Zilla, UPNShare, Byse, YourUpload y StreamTape no están implementados.
  Si no hay videos extraídos, se muestra un error explícito.
- La página de HLS/Zilla consultada respondió con protección de Cloudflare.
  No se implementó ni verificó su resolución.
- La disponibilidad depende de la API y de cada servidor. No hay reintentos
  automáticos masivos ni rastreo completo del catálogo.

## Validación realizada — 30 de octubre de 2026

Con Node.js, `npm test` pasó **7 pruebas**: normalización de URLs de novedades,
deduplicación, paginación, consulta codificada, resultados vacíos frente a
errores de API, mapeo de detalles, fallback entre extractores simulados,
rechazo de embeds y metadatos del índice.

`npm run smoke` ejecutó el adaptador contra la API pública, de forma secuencial:
20 novedades, 19 resultados para `naruto`, ficha de Naruto con 220 episodios y
respuesta del episodio con servidores. Estos conteos pueden cambiar.

**No se ejecutó el motor QuickJS de Mangayomi, sus extractores nativos ni un
reproductor. No está verificada la compatibilidad de ejecución, la instalación,
la reproducción, las descargas ni el funcionamiento en Onn TV.** Las pruebas de
extractores usan simulaciones y no prueban que Voe o MP4Upload funcionen hoy.

Para reproducir las comprobaciones locales con Node.js 22 o posterior:

```sh
npm test
npm run smoke
```

No se necesitan dependencias npm. `smoke` hace cuatro consultas reales y requiere
Internet; las pruebas unitarias no hacen consultas externas.

## Fuentes técnicas investigadas

- [animeav1-api](https://github.com/ahmedrangel/animeav1-api/tree/e0303018c18cd62ae7fddf94d61ac5bc90a953eb): rutas de búsqueda, novedades, anime y episodio. Se usó el esquema `success/data`, `media/hasNextPage`, `episodes` y `embeds`.
- [Mangayomi 0.9.9, código consultado](https://github.com/kodjodevf/mangayomi/tree/fd89a37ac6c1dcbc0fad361fd874fee21bf74c7e): `lib/eval/javascript/service.dart`, `http.dart`, `extractors.dart`, modelos `Source`, `MManga`, `MChapter`, `Video` y cargador `fetch_sources_list.dart`. El índice identifica `itemType: 1` y `sourceCodeLanguage: 1`.
- [Guía JavaScript del catálogo original archivado](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/CONTRIBUTING-JS.md): referencia histórica complementaria; no es evidencia de compatibilidad actual.

`appMinVerReq: 0.5.0` sigue la referencia histórica del formato JavaScript;
no representa una versión mínima probada. La interfaz actual se contrastó
con el código de 0.9.9 indicado arriba.

## Pendiente de comprobar en Mangayomi / Onn TV

1. Agregar el índice, instalar y abrir AnimeAV1 sin errores de carga.
2. Abrir novedades, buscar un anime y comprobar ficha y orden de episodios.
3. Abrir un episodio, comprobar extracción real de Voe/MP4Upload y reproducción
   de video y audio, avance temporal, subtítulos si existen y cabeceras requeridas.
4. Verificar navegación con control remoto en Onn TV y anotar versión de la app,
   episodio, servidor y error si falla. No compartir tokens ni enlaces firmados.
5. Implementar y probar otros servidores solo después de estudiar sus respuestas.

Los archivos del adaptador y pruebas fueron escritos para este repositorio;
no se copiaron implementaciones de extractores de terceros.
