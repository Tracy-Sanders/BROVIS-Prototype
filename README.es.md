# BROVIS

**Bro's Virtual Intelligence System** — un panel matutino autoalojado inspirado en J.A.R.V.I.S. Código abierto. BYOK. Sin cuentas, sin telemetría, sin dependencia de la nube.

# Descripción general
Prototipo [LLM](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) de Karpathy con datos de Resumen y Viajes.
![LLM Overview](/data/media/es/01%20LLM%20Ingest%20Analyze.png)

---

## LLM
### Ingestión

#### Obsidian Web Clipper para guardar información de sitios web:
![LLM Clipper](/data/media/02%20Obsidian%20Web%20Clipper.png)

#### Arrastrar sitio web guardado a la ventana de ingestión, analizar y seleccionar entrada:
![LLM Ingest](/data/media/es/03%20LLM%20Ingest%20Save%20All%20Pages.png)

#### Guardar todas las páginas para importar al LLM
![LLM Save](/data/media/es/04%20LLM%20Ingest%20Save%20All%20Pages.png)

---

### Consulta al LLM

![LLM Query](/data/media/es/05%20LLM%20Query.png)

---

### Lint — Verificación de salud del LLM
![LLM Lint](/data/media/es/06%20LLM%20Lint.png)

---

### Arnés de pruebas con scripts automatizados
![LLM Test](/data/media/es/07%20LLM%20Test.png)

### Integración con Obsidian

La carpeta `data/` es un vault válido de Obsidian. Ábrela en Obsidian para obtener vista de grafo, navegación por backlinks y el flujo de trabajo con Web Clipper para ingestión rápida desde el navegador.

#### Grafo de Obsidian
![Obsidian Graph](/data/media/08%20Obsidian%20Graph.png)

#### Plugin de mapas de Obsidian
![Obsidian Maps](/data/media/09%20Obsidian%20Map%20Base.png)

---

## Privacidad y seguridad

> Tus claves de API se almacenan únicamente en el `localStorage` de tu navegador. Nunca se escriben en un archivo del servidor, nunca se registran y nunca salen de tu dispositivo. El servidor de BROVIS es un proxy CORS mínimo — sin telemetría, sin cuentas, sin rastreo.

Consulta [SECURITY.md](SECURITY.md) para ver el diagrama completo del flujo de datos.

---

## Características

- **Karpathy** - [LLM](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- **Base de conocimiento de lugares** — 192 páginas wiki sobre ciudades, monumentos y regiones, consultables mediante la capa LLM (ver [Base de conocimiento](#base-de-conocimiento))
- **BYOK** — tú suministras tus propias claves de API; viven en el localStorage de tu navegador, nunca en un servidor
- **Arquitectura de widgets** — cada widget es un archivo independiente; añade uno colocando un nuevo archivo en `src/widgets/`
- **Aislamiento de widgets** — un widget que falla nunca mata el SITREP (Promise.allSettled)
- **Interfaz de configuración completa** — perfil, claves de API y controles por widget en una sola página de ajustes
- **i18n** — interfaz disponible en inglés, español, alemán y chino
- **SITREP** — un solo comando (o clic) reúne tiempo, mercados, versículo bíblico, calendario y noticias en una tarjeta limpia
- **Versículo KJV** — versículo aleatorio de una lista curada en cada ejecución
- **Google Calendar** — OAuth2, solo eventos de hoy
- **Mercados** — BTC, Oro, Plata, Petróleo, S&P 500, Dow Jones, NASDAQ, Russell 2000 (sin clave requerida)
- **Resumen matutino** — Claude sintetiza tiempo, noticias, mercados y calendario en un resumen ejecutivo (opt-in; BYOK)
- **Titulares deportivos** — principales noticias deportivas de EE. UU. vía NewsAPI
- **Correo VIP** — los correos no leídos más recientes de contactos destacados de Google (Google OAuth2, sin clave adicional)
- **Enrutamiento por hash** — enlace directo a cualquier vista: `#am-brief`, `#pm-brief`, `#sitrep`, `#config`, `#llm-ingest`, `#llm-query`, `#travel-calendar`

---

## Vista de lugar en el calendario de viajes
![Travel Place](/data/media/es/11%20Calendar%20Sydney%20English.png)

---

## Configuración del resumen
![Travel Place](/data/media/es/11%20Calendar%20Sydney%20English.png)

---

## Resumen — parte superior
![Brief Top](/data/media/es/13%20Brief%20AM%201.png)

---

## Resumen — parte inferior
![Brief Bottom](/data/media/es/14%20Brief%20AM%202.png)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Módulos ES de JS puro, sin framework |
| Servidor | Node.js + Express (proxy CORS, OAuth) |
| Estilos | CSS puro con tokens de diseño |
| Almacenamiento | localStorage del navegador |
| Autenticación | Google OAuth2 (solo calendario) |

---

## Inicio rápido

### 1. Requisitos previos

- Node.js 18+
- Claves de API (ver más abajo)

### 2. Clonar e instalar

```bash
git clone https://github.com/Tracy-Sanders/BROVIS.git
cd brovis
npm install
```

### 3. Configurar el entorno

```bash
cp .env.example .env
# Edita .env — establece PORT y opcionalmente tus claves de desarrollo
```

### 4. Ejecutar

```bash
npm run dev     # nodemon — se reinicia automáticamente con los cambios
# o
npm start       # node simple
```

Abre `http://localhost:3001` y haz clic en **CONFIG** para ingresar tus claves de API.

---

## Pruebas

```bash
npm test                  # ejecutar todas las pruebas una vez
npm run test:watch        # re-ejecutar con cada cambio
npm run test:coverage     # mostrar reporte de cobertura
```

---

## Claves de API

BROVIS utiliza el modelo BYOK (trae tu propia clave). Las claves se almacenan en tu navegador y se envían directamente a sus APIs — el servidor de BROVIS solo actúa como proxy para evitar restricciones CORS.

| Widget | Servicio | Nivel gratuito |
|---|---|---|
| Tiempo | [OpenWeatherMap](https://openweathermap.org/api) | Sí — 1.000 llamadas/día |
| Noticias / Deportes | [NewsAPI](https://newsapi.org) | Sí — 100 solicitudes/día |
| Mercados | CoinGecko + Stooq | Sin clave necesaria |
| Biblia | bible-api.com | Sin clave necesaria |
| Calendario | Google Calendar API | Gratuito (OAuth2) |
| Correo VIP | Google Gmail API | Gratuito (OAuth2, mismas credenciales que el Calendario) |
| Resumen matutino / LLM | [Anthropic Claude](https://console.anthropic.com) | Pago por token |

---

## Configuración de Google Calendar

1. Ve a [Google Cloud Console](https://console.cloud.google.com) → APIs y servicios → Credenciales
2. Crea un **ID de cliente OAuth 2.0** (aplicación web)
3. Añade `http://localhost:3001/auth/google/callback` como URI de redireccionamiento autorizado
4. Copia el ID de cliente y el secreto en tu `.env`
5. Haz clic en **Conectar Google Calendar** en el SITREP para autorizar

---

## Base de conocimiento

BROVIS incluye una base de conocimiento personal de viajes (el "wiki Karpathy") — 192 páginas de lugares que cubren ciudades, monumentos y regiones de Europa, América, Asia, Australia y África. Cada página utiliza un esquema YAML frontmatter consistente para que Claude pueda ingerir, consultar y cruzar referencias de forma fiable.

| Ruta | Propósito |
|---|---|
| `data/place/` | Páginas wiki en inglés (canónicas) |
| `data/place/es/` | Traducciones al español — mismos nombres de archivo |
| `data/index.md` | Índice maestro de todas las páginas |
| `data/log.md` | Registro de cambios |

### Flujos de trabajo LLM

Cuatro páginas dedicadas son accesibles desde la barra de navegación:

| Ruta | Propósito |
|---|---|
| `#llm-ingest` | Introduce una URL o pega texto → Claude genera páginas wiki estructuradas |
| `#llm-query` | Haz preguntas sobre la base de conocimiento → Claude sintetiza una respuesta |
| `#llm-healthcheck` | Valida que tu clave de API de Claude funciona correctamente |
| `#llm-test` | Ejecuta el conjunto de pruebas LLM con tu clave |

---

## Añadir un widget

Crea `src/widgets/mi-widget.js`:

```js
export default {
  id: 'mi-widget',
  name: 'Mi Widget',
  requiredKeys: [],        // claves de config.keys que deben estar configuradas
  requiredFields: [],      // dotpaths en config (ej. 'user.location')
  defaultEnabled: true,
  order: 60,               // valor menor se renderiza antes en el SITREP

  async fetch(config) {
    // devuelve cualquier estructura de datos que necesites
  },

  render(data) {
    return `<div class="sitrep-section">...</div>`;
  }
};
```

Luego añade un import y una entrada en [src/widgets/index.js](src/widgets/index.js):

```js
import miWidget from './mi-widget.js';
export const widgets = [...existing, miWidget].sort(...);
```

Listo. El widget obtiene automáticamente:
- Un interruptor en la página de ajustes de CONFIG
- Un marcador "necesita configuración" si faltan las claves requeridas
- Aislamiento de widgets (un fallo no mata el SITREP)

---

## Estructura del proyecto

```
brovis/
├── index.html
├── server/
│   └── index.js              Proxy Express + Google OAuth (Calendar + Gmail)
├── src/
│   ├── orchestrator.js       Punto de entrada de la app — conecta todo
│   ├── brovis.css
│   ├── lib/
│   │   ├── config.js         Fuente única de verdad para la config del usuario (BYOK)
│   │   ├── storage.js        Abstracción de localStorage (namespace brovis.*)
│   │   ├── http.js           Wrapper fetch compartido + cabecera X-Brovis-Key
│   │   ├── i18n.js           Traducciones (en/es/de/zh) + aplicación al DOM
│   │   └── claude.js         Cliente LLM (complete, chat, chatRaw)
│   ├── widgets/
│   │   ├── index.js          Registro — isWidgetVisible, isWidgetRunnable
│   │   ├── weather.js
│   │   ├── news.js
│   │   ├── markets.js
│   │   ├── bible.js
│   │   ├── calendar.js
│   │   ├── morning-brief.js  Síntesis Claude del contexto SITREP (opt-in)
│   │   ├── sports.js
│   │   ├── gmail.js          Correo VIP — contactos destacados, Google OAuth2
│   │   ├── music.js
│   │   ├── fitness-tips.js
│   │   ├── tasks.js
│   │   └── traffic.js
│   └── display/
│       ├── sitrep.js         Shell del SITREP + helpers de respaldo
│       ├── config.js         Renderizador de la página de configuración
│       ├── llm-ingest.js     Flujo de trabajo de ingestión a la base de conocimiento
│       ├── llm-query.js      Flujo de trabajo de consulta a la base de conocimiento
│       ├── llm-healthcheck.js  Verificación de salud de la clave de API
│       └── llm-test.js       Ejecutor del conjunto de pruebas LLM
├── data/
│   ├── place/                192 páginas wiki de lugares (inglés)
│   │   └── es/               Traducciones al español
│   ├── index.md              Índice maestro de la base de conocimiento
│   └── log.md                Registro de cambios
├── maps/
│   └── vault-map.md          Guía de navegación para agentes LLM
├── metadata/
│   └── llm-schema.md         Esquema de páginas + convenciones YAML frontmatter
├── .env.example
├── LICENSE
└── package.json
```

---

## Licencia

MIT — ver [LICENSE](LICENSE).

---

## Agradecimientos

- [OpenWeatherMap](https://openweathermap.org) — datos meteorológicos
- [NewsAPI](https://newsapi.org) — titulares de noticias
- [CoinGecko](https://coingecko.com) — precios de criptomonedas
- [Stooq](https://stooq.com) — datos del mercado de valores
- [bible-api.com](https://bible-api.com) — versículos de la Biblia KJV
- [Google Calendar API](https://developers.google.com/calendar) — integración de calendario
- [Anthropic Claude](https://anthropic.com) — capa de IA
