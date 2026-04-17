/**
 * BROVIS Internationalisation module.
 *
 * Usage:
 *   import { t, initI18n, setLang, applyI18nToDOM } from './lib/i18n.js';
 *
 *   initI18n();          // call once after loadConfig()
 *   t('nav.brief');      // returns translated string for active language
 *   setLang('es');       // switch language immediately
 *   applyI18nToDOM();    // re-translate all data-i18n elements in the DOM
 */

import { getConfig } from './config.js';

// ── Language module state ─────────────────────────────────────────────────────

let _lang = 'en';

export function initI18n() {
  try {
    _lang = getConfig().i18n?.displayLanguage ?? 'en';
  } catch {
    _lang = 'en';
  }
}

export function setLang(lang) {
  _lang = lang || 'en';
}

export function getLang() {
  return _lang;
}

// ── Core translate function ───────────────────────────────────────────────────

/**
 * Translate a key to the active language.
 * Supports {variable} interpolation: t('ingest.translating', { name: 'Caracas', lang: 'Spanish' })
 * Falls back to English, then to the key itself.
 */
export function t(key, vars = {}) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  const str = entry[_lang] ?? entry['en'] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

// ── DOM application helper ────────────────────────────────────────────────────

/**
 * Apply translations to all [data-i18n] elements currently in the DOM.
 * Call after initI18n() and after any language change.
 */
export function applyI18nToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}

// ── Translations dictionary ───────────────────────────────────────────────────

const TRANSLATIONS = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.brief':          { en: '[ BRIEF ]',    es: '[ RESUMEN ]',   de: '[ BRIEF ]',       zh: '[ 简报 ]' },
  'nav.travel':         { en: '[ TRAVEL ]',   es: '[ VIAJES ]',    de: '[ REISEN ]',      zh: '[ 旅行 ]' },
  'nav.llm':            { en: '[ LLM ]',      es: '[ LLM ]',       de: '[ LLM ]',         zh: '[ LLM ]' },
  'subtab.am-brief':    { en: 'AM BRIEF',     es: 'RESUMEN AM',    de: 'MORGENBERICHT',   zh: '早间简报' },
  'subtab.sitrep':      { en: 'SITREP',       es: 'SITREP',        de: 'LAGEBERICHT',     zh: '态势报告' },
  'subtab.pm-brief':    { en: 'PM BRIEF',     es: 'RESUMEN PM',    de: 'ABENDBERICHT',    zh: '晚间简报' },
  'subtab.calendar':    { en: 'CALENDAR',     es: 'CALENDARIO',    de: 'KALENDER',        zh: '日历' },
  'subtab.ingest':      { en: 'INGEST',       es: 'INGERIR',       de: 'AUFNAHME',        zh: '摄取' },
  'subtab.query':       { en: 'QUERY',        es: 'CONSULTA',      de: 'ABFRAGE',         zh: '查询' },
  'subtab.lint':        { en: 'LINT',         es: 'LINT',          de: 'LINT',            zh: '检查' },
  'input.placeholder':  { en: 'Give me a command...', es: 'Dame una orden...', de: 'Befehl eingeben...', zh: '输入指令...' },

  // ── Config panel ────────────────────────────────────────────────────────────
  'config.title':               { en: '// BROVIS CONFIGURATION', es: '// CONFIGURACIÓN BROVIS', de: '// BROVIS KONFIGURATION', zh: '// BROVIS 配置' },
  'config.welcome':             { en: 'Welcome. BROVIS is BYOK — your keys stay in your browser and never leave your device.', es: 'Bienvenido. BROVIS es BYOK — tus claves permanecen en tu navegador y nunca salen de tu dispositivo.', de: 'Willkommen. BROVIS ist BYOK — deine Schlüssel bleiben in deinem Browser und verlassen dein Gerät nicht.', zh: '欢迎。BROVIS 采用 BYOK 模式 — 您的密钥保存在浏览器中，永不离开您的设备。' },
  'config.section.profile':     { en: 'Profile',           es: 'Perfil',             de: 'Profil',              zh: '个人资料' },
  'config.section.apikeys':     { en: 'API Keys (BYOK)',   es: 'Claves API (BYOK)',  de: 'API-Schlüssel (BYOK)', zh: 'API 密钥 (BYOK)' },
  'config.section.widgets':     { en: 'Widgets',           es: 'Widgets',            de: 'Widgets',             zh: '小部件' },
  'config.section.modes':       { en: 'Modes',             es: 'Modos',              de: 'Modi',                zh: '模式' },
  'config.section.languages':   { en: 'Languages',         es: 'Idiomas',            de: 'Sprachen',            zh: '语言' },
  'config.label.name':          { en: 'Name',              es: 'Nombre',             de: 'Name',                zh: '姓名' },
  'config.label.location':      { en: 'Location',          es: 'Ubicación',          de: 'Standort',            zh: '位置' },
  'config.label.units':         { en: 'Units',             es: 'Unidades',           de: 'Einheiten',           zh: '单位' },
  'config.label.units.imperial':{ en: 'Imperial',          es: 'Imperial',           de: 'Imperial',            zh: '英制' },
  'config.label.units.metric':  { en: 'Metric',            es: 'Métrico',            de: 'Metrisch',            zh: '公制' },
  'config.label.greeting':      { en: 'Greeting Style',    es: 'Estilo de saludo',   de: 'Begrüßungsstil',      zh: '问候风格' },
  'config.label.greeting.direct':  { en: 'Direct',         es: 'Directo',            de: 'Direkt',              zh: '直接' },
  'config.label.greeting.formal':  { en: 'Formal',         es: 'Formal',             de: 'Förmlich',            zh: '正式' },
  'config.label.greeting.casual':  { en: 'Casual',         es: 'Informal',           de: 'Locker',              zh: '随意' },
  'config.label.interface':     { en: 'Interface',         es: 'Interfaz',           de: 'Benutzeroberfläche',  zh: '界面' },
  'config.label.displaylang':   { en: 'Display Language',  es: 'Idioma de pantalla', de: 'Anzeigesprache',      zh: '显示语言' },
  'config.label.available':     { en: 'Available Languages', es: 'Idiomas disponibles', de: 'Verfügbare Sprachen', zh: '可用语言' },
  'config.save':                { en: 'Save',              es: 'Guardar',            de: 'Speichern',           zh: '保存' },
  'config.save.firstrun':       { en: 'Save & Run SITREP', es: 'Guardar y ejecutar SITREP', de: 'Speichern & SITREP ausführen', zh: '保存并运行态势报告' },
  'config.cancel':              { en: 'Cancel',            es: 'Cancelar',           de: 'Abbrechen',           zh: '取消' },
  'config.requires':            { en: 'requires',          es: 'requiere',           de: 'erfordert',           zh: '需要' },

  // ── Ingest ───────────────────────────────────────────────────────────────────
  'ingest.header':              { en: '// LLM INGEST',             es: '// INGESTIÓN LLM',        de: '// LLM-AUFNAHME',          zh: '// LLM 摄取' },
  'ingest.title.nokey':         { en: 'CONFIGURATION REQUIRED',    es: 'CONFIGURACIÓN REQUERIDA', de: 'KONFIGURATION ERFORDERLICH', zh: '需要配置' },
  'ingest.nokey':               { en: 'Claude API key required. Add it in CONFIG to enable ingestion.', es: 'Se requiere clave API de Claude. Agrégala en CONFIG para habilitar la ingestión.', de: 'Claude-API-Schlüssel erforderlich. Füge ihn in CONFIG hinzu, um die Aufnahme zu aktivieren.', zh: '需要 Claude API 密钥。请在 CONFIG 中添加以启用摄取功能。' },
  'ingest.title.input':         { en: 'SOURCE DOCUMENT',           es: 'DOCUMENTO FUENTE',        de: 'QUELLDOKUMENT',            zh: '源文档' },
  'ingest.hint.paste':          { en: 'Paste the full text of a source document or drag a .md file onto the drop zone.', es: 'Pega el texto completo de un documento fuente o arrastra un archivo .md a la zona de soltar.', de: 'Füge den vollständigen Text eines Quelldokuments ein oder ziehe eine .md-Datei in die Ablagezone.', zh: '粘贴源文档的完整文本，或将 .md 文件拖到放置区。' },
  'ingest.drop':                { en: 'Drop .md file here',        es: 'Suelta el archivo .md aquí', de: '.md-Datei hier ablegen',  zh: '在此处放置 .md 文件' },
  'ingest.placeholder':         { en: 'Paste source document content here...', es: 'Pega el contenido del documento fuente aquí...', de: 'Quelldokumentinhalt hier einfügen...', zh: '在此处粘贴源文档内容...' },
  'ingest.btn.analyze':         { en: 'ANALYZE',                   es: 'ANALIZAR',                de: 'ANALYSIEREN',              zh: '分析' },
  'ingest.btn.back':            { en: 'BACK',                      es: 'ATRÁS',                   de: 'ZURÜCK',                   zh: '返回' },
  'ingest.btn.generate':        { en: 'GENERATE PAGES',            es: 'GENERAR PÁGINAS',         de: 'SEITEN GENERIEREN',        zh: '生成页面' },
  'ingest.btn.save':            { en: 'SAVE ALL PAGES',            es: 'GUARDAR TODAS LAS PÁGINAS', de: 'ALLE SEITEN SPEICHERN',  zh: '保存所有页面' },
  'ingest.btn.retry':           { en: 'RETRY',                     es: 'REINTENTAR',              de: 'ERNEUT VERSUCHEN',         zh: '重试' },
  'ingest.btn.new':             { en: 'NEW INGESTION',             es: 'NUEVA INGESTIÓN',         de: 'NEUE AUFNAHME',            zh: '新摄取' },
  'ingest.title.analyzing':     { en: 'ANALYZING SOURCE',          es: 'ANALIZANDO FUENTE',       de: 'QUELLE WIRD ANALYSIERT',   zh: '正在分析源文档' },
  'ingest.spinner.process':     { en: 'Processing document through Claude...', es: 'Procesando documento con Claude...', de: 'Dokument wird durch Claude verarbeitet...', zh: '正在通过 Claude 处理文档...' },
  'ingest.spinner.truncated':   { en: '(large doc — trimmed to fit)', es: '(documento grande — recortado)', de: '(großes Dokument — gekürzt)', zh: '（大型文档 — 已截断）' },
  'ingest.title.failed':        { en: 'ANALYSIS FAILED',           es: 'ANÁLISIS FALLIDO',        de: 'ANALYSE FEHLGESCHLAGEN',   zh: '分析失败' },
  'ingest.title.takeaways':     { en: 'KEY TAKEAWAYS',             es: 'PUNTOS CLAVE',            de: 'WICHTIGE ERKENNTNISSE',    zh: '关键要点' },
  'ingest.title.places':        { en: 'PLACES IDENTIFIED ({count})', es: 'LUGARES IDENTIFICADOS ({count})', de: 'IDENTIFIZIERTE ORTE ({count})', zh: '已识别地点 ({count})' },
  'ingest.hint.uncheck':        { en: 'Uncheck any places you don\'t want to generate pages for.', es: 'Desmarca los lugares para los que no deseas generar páginas.', de: 'Deaktiviere Orte, für die keine Seiten generiert werden sollen.', zh: '取消勾选您不想生成页面的地点。' },
  'ingest.title.generating':    { en: 'GENERATING PAGES',          es: 'GENERANDO PÁGINAS',       de: 'SEITEN WERDEN GENERIERT',  zh: '正在生成页面' },
  'ingest.spinner.generating':  { en: 'Generating {count} page(s)...', es: 'Generando {count} página(s)...', de: '{count} Seite(n) wird/werden generiert...', zh: '正在生成 {count} 个页面...' },
  'ingest.title.done':          { en: 'GENERATED PAGES ({count})', es: 'PÁGINAS GENERADAS ({count})', de: 'GENERIERTE SEITEN ({count})', zh: '已生成页面 ({count})' },
  'ingest.hint.copy':           { en: 'Copy each page and save it to the corresponding path in your vault.', es: 'Copia cada página y guárdala en la ruta correspondiente en tu bóveda.', de: 'Kopiere jede Seite und speichere sie im entsprechenden Pfad in deinem Tresor.', zh: '复制每个页面并将其保存到保险库中的相应路径。' },
  'ingest.title.translating':   { en: 'TRANSLATING PAGES',         es: 'TRADUCIENDO PÁGINAS',     de: 'SEITEN WERDEN ÜBERSETZT',  zh: '正在翻译页面' },
  'ingest.translating':         { en: 'Translating {name} to {lang}...', es: 'Traduciendo {name} a {lang}...', de: '{name} wird nach {lang} übersetzt...', zh: '正在将 {name} 翻译为 {lang}...' },
  'ingest.translated.done':     { en: '{name} [{lang}] — done',    es: '{name} [{lang}] — listo',  de: '{name} [{lang}] — fertig', zh: '{name} [{lang}] — 完成' },
  'ingest.translated.fail':     { en: '{name} [{lang}] — failed: {err}', es: '{name} [{lang}] — error: {err}', de: '{name} [{lang}] — fehlgeschlagen: {err}', zh: '{name} [{lang}] — 失败：{err}' },

  // ── Query ────────────────────────────────────────────────────────────────────
  'query.header':               { en: '// LLM QUERY',              es: '// CONSULTA LLM',         de: '// LLM-ABFRAGE',           zh: '// LLM 查询' },
  'query.title.nokey':          { en: 'CONFIGURATION REQUIRED',    es: 'CONFIGURACIÓN REQUERIDA', de: 'KONFIGURATION ERFORDERLICH', zh: '需要配置' },
  'query.nokey':                { en: 'Claude API key required. Add it in CONFIG to enable queries.', es: 'Se requiere clave API de Claude. Agrégala en CONFIG para habilitar consultas.', de: 'Claude-API-Schlüssel erforderlich. Füge ihn in CONFIG hinzu, um Abfragen zu aktivieren.', zh: '需要 Claude API 密钥。请在 CONFIG 中添加以启用查询功能。' },
  'query.title':                { en: 'ASK THE WIKI',              es: 'CONSULTAR LA WIKI',       de: 'WIKI BEFRAGEN',            zh: '查询知识库' },
  'query.hint':                 { en: 'Ask a question. Claude will search your wiki, read the relevant pages, and synthesize an answer with citations.', es: 'Haz una pregunta. Claude buscará en tu wiki, leerá las páginas relevantes y sintetizará una respuesta con citas.', de: 'Stelle eine Frage. Claude durchsucht dein Wiki, liest die relevanten Seiten und erstellt eine Antwort mit Quellenangaben.', zh: '提问。Claude 将搜索您的知识库，阅读相关页面，并综合带引用的答案。' },
  'query.placeholder':          { en: 'e.g. What are the best Greek islands for beaches and history?', es: 'ej. ¿Cuáles son las mejores islas griegas para playas e historia?', de: 'z.B. Was sind die besten griechischen Inseln für Strände und Geschichte?', zh: '例如：哪些希腊岛屿最适合海滩和历史探索？' },
  'query.btn.query':            { en: 'QUERY',                     es: 'CONSULTAR',               de: 'ABFRAGEN',                 zh: '查询' },
  'query.btn.copy':             { en: 'COPY',                      es: 'COPIAR',                  de: 'KOPIEREN',                 zh: '复制' },
  'query.btn.copied':           { en: 'COPIED',                    es: 'COPIADO',                 de: 'KOPIERT',                  zh: '已复制' },
  'query.btn.file':             { en: 'FILE AS PAGE',              es: 'ARCHIVAR COMO PÁGINA',    de: 'ALS SEITE ABLEGEN',        zh: '归档为页面' },
  'query.btn.saving':           { en: 'SAVING...',                 es: 'GUARDANDO...',            de: 'SPEICHERN...',             zh: '保存中...' },
  'ingest.saved':               { en: '✓ SAVED {count} PAGE(S)',   es: '✓ GUARDADO(S) {count}',   de: '✓ {count} SEITE(N) GESPE.', zh: '✓ 已保存 {count} 页' },
  'ingest.saved.errors':        { en: '(WITH ERRORS)',             es: '(CON ERRORES)',            de: '(MIT FEHLERN)',             zh: '(有错误)' },
  'ingest.save.failed':         { en: 'SAVE FAILED',               es: 'ERROR AL GUARDAR',         de: 'SPEICHERN FEHLG.',          zh: '保存失败' },
  'query.btn.filed':            { en: 'FILED',                     es: 'ARCHIVADO',               de: 'ABGELEGT',                 zh: '已归档' },
  'query.btn.failed':           { en: 'FAILED',                    es: 'FALLIDO',                 de: 'FEHLGESCHLAGEN',           zh: '失败' },
  'query.btn.new':              { en: 'NEW QUERY',                 es: 'NUEVA CONSULTA',          de: 'NEUE ABFRAGE',             zh: '新查询' },
  'query.btn.retry':            { en: 'RETRY',                     es: 'REINTENTAR',              de: 'ERNEUT VERSUCHEN',         zh: '重试' },
  'query.title.searching':      { en: 'SEARCHING WIKI',            es: 'BUSCANDO EN WIKI',        de: 'WIKI WIRD DURCHSUCHT',     zh: '搜索知识库' },
  'query.searching':            { en: 'Reading index, identifying relevant pages...', es: 'Leyendo índice, identificando páginas relevantes...', de: 'Index wird gelesen, relevante Seiten werden identifiziert...', zh: '读取索引，识别相关页面...' },
  'query.title.fetching':       { en: 'FETCHING PAGES',            es: 'OBTENIENDO PÁGINAS',      de: 'SEITEN WERDEN ABGERUFEN',  zh: '获取页面' },
  'query.title.synthesizing':   { en: 'SYNTHESIZING ANSWER',       es: 'SINTETIZANDO RESPUESTA',  de: 'ANTWORT WIRD ZUSAMMENGEFASST', zh: '综合答案' },
  'query.title.answer':         { en: 'ANSWER',                    es: 'RESPUESTA',               de: 'ANTWORT',                  zh: '回答' },
  'query.sources':              { en: 'Sources read',              es: 'Fuentes leídas',          de: 'Gelesene Quellen',         zh: '已读来源' },
  'query.title.failed':         { en: 'QUERY FAILED',              es: 'CONSULTA FALLIDA',        de: 'ABFRAGE FEHLGESCHLAGEN',   zh: '查询失败' },

  // ── Health Check (Lint) ───────────────────────────────────────────────────────
  'lint.header':                { en: '// LLM HEALTH CHECK',       es: '// VERIFICACIÓN LLM',     de: '// LLM-GESUNDHEITSCHECK',  zh: '// LLM 健康检查' },
  'lint.title.nokey':           { en: 'CONFIGURATION REQUIRED',    es: 'CONFIGURACIÓN REQUERIDA', de: 'KONFIGURATION ERFORDERLICH', zh: '需要配置' },
  'lint.nokey':                 { en: 'Claude API key required. Add it in CONFIG to enable health checks.', es: 'Se requiere clave API de Claude. Agrégala en CONFIG para habilitar las verificaciones de salud.', de: 'Claude-API-Schlüssel erforderlich. Füge ihn in CONFIG hinzu, um Gesundheitsprüfungen zu aktivieren.', zh: '需要 Claude API 密钥。请在 CONFIG 中添加以启用健康检查功能。' },
  'lint.title':                 { en: 'WIKI HEALTH CHECK',         es: 'VERIFICACIÓN DE WIKI',    de: 'WIKI-GESUNDHEITSCHECK',    zh: '知识库健康检查' },
  'lint.hint':                  { en: 'Claude will read every page in your wiki and produce a full audit report covering contradictions, orphan pages, missing cross-references, data gaps, and suggested next questions.', es: 'Claude leerá cada página de tu wiki y producirá un informe de auditoría completo que cubre contradicciones, páginas huérfanas, referencias cruzadas faltantes, brechas de datos y preguntas siguientes sugeridas.', de: 'Claude liest jede Seite in deinem Wiki und erstellt einen vollständigen Prüfbericht über Widersprüche, verwaiste Seiten, fehlende Querverweise, Datenlücken und vorgeschlagene Folgefragen.', zh: 'Claude 将读取知识库中的每个页面，并生成完整的审计报告，涵盖矛盾之处、孤立页面、缺失的交叉引用、数据缺口和建议的后续问题。' },
  'lint.btn.run':               { en: 'RUN HEALTH CHECK',          es: 'EJECUTAR VERIFICACIÓN',   de: 'GESUNDHEITSCHECK STARTEN', zh: '运行健康检查' },
  'lint.title.loading':         { en: 'LOADING WIKI',              es: 'CARGANDO WIKI',           de: 'WIKI WIRD GELADEN',        zh: '加载知识库' },
  'lint.fetching':              { en: 'Fetching page list...',      es: 'Obteniendo lista de páginas...', de: 'Seitenliste wird abgerufen...', zh: '获取页面列表...' },
  'lint.pagecount':             { en: 'Wiki contains {count} page(s) in /data/place/.', es: 'La wiki contiene {count} página(s) en /data/place/.', de: 'Wiki enthält {count} Seite(n) in /data/place/.', zh: '知识库在 /data/place/ 中包含 {count} 个页面。' },
  'lint.nopages':               { en: 'No pages found in /data/place/. Ingest some sources first.', es: 'No se encontraron páginas en /data/place/. Primero ingiere algunas fuentes.', de: 'Keine Seiten in /data/place/ gefunden. Bitte zuerst Quellen aufnehmen.', zh: '在 /data/place/ 中未找到页面。请先摄取一些来源。' },

  // ── Test Suite ───────────────────────────────────────────────────────────────
  'subtab.test':          { en: 'TEST',                                          es: 'PRUEBA',                                          de: 'TEST',                                                     zh: '测试' },
  'test.header':          { en: '// TEST SUITE',                                 es: '// PRUEBA',                                        de: '// TESTSUITE',                                             zh: '// 测试套件' },
  'test.title':           { en: 'RUN TEST SUITE',                                es: 'EJECUTAR PRUEBA',                                  de: 'TESTSUITE STARTEN',                                        zh: '运行测试套件' },
  'test.hint':            { en: 'Runs npm test and npm run test:coverage and shows the raw output.', es: 'Ejecuta npm test y npm run test:coverage y muestra la salida.', de: 'Führt npm test und npm run test:coverage aus und zeigt die Ausgabe.', zh: '运行 npm test 和 npm run test:coverage 并显示原始输出。' },
  'test.btn.run':         { en: 'RUN TESTS',                                     es: 'EJECUTAR PRUEBAS',                                 de: 'TESTS AUSFÜHREN',                                          zh: '运行测试' },
  'test.btn.rerun':       { en: 'RUN AGAIN',                                     es: 'EJECUTAR DE NUEVO',                                de: 'ERNEUT AUSFÜHREN',                                         zh: '重新运行' },
  'test.title.running':   { en: 'RUNNING TESTS',                                 es: 'EJECUTANDO PRUEBAS',                               de: 'TESTS LAUFEN',                                             zh: '正在运行测试' },
  'test.running':         { en: 'Running npm test and npm run test:coverage...', es: 'Ejecutando npm test y npm run test:coverage...', de: 'npm test und npm run test:coverage wird ausgeführt...', zh: '正在运行 npm test 和 npm run test:coverage...' },
  'test.title.results':   { en: 'TEST RESULTS',                                  es: 'RESULTADOS',                                       de: 'TESTERGEBNISSE',                                           zh: '测试结果' },
  'test.label.test':      { en: 'npm test',                                      es: 'npm test',                                         de: 'npm test',                                                 zh: 'npm test' },
  'test.label.coverage':  { en: 'npm run test:coverage',                         es: 'npm run test:coverage',                            de: 'npm run test:coverage',                                    zh: 'npm run test:coverage' },
  'test.title.failed':    { en: 'TEST FAILED',                                   es: 'PRUEBA FALLIDA',                                   de: 'TEST FEHLGESCHLAGEN',                                      zh: '测试失败' },

  // ── General status / errors ───────────────────────────────────────────────────
  'info.pulling':               { en: 'Pulling current data...', es: 'Obteniendo datos actuales...', de: 'Aktuelle Daten werden abgerufen...', zh: '正在获取当前数据...' },
  'info.thinking':              { en: 'Thinking...',             es: 'Pensando...',                  de: 'Nachdenken...',                    zh: '思考中...' },
  'info.notrecognized':         { en: "Command not recognized. Try 'AM Brief', 'PM Brief', 'SITREP', or 'config'. Add a Claude key in CONFIG to enable free-form Q&A.", es: "Comando no reconocido. Prueba 'AM Brief', 'PM Brief', 'SITREP' o 'config'. Agrega una clave Claude en CONFIG para habilitar preguntas libres.", de: "Befehl nicht erkannt. Versuche 'AM Brief', 'PM Brief', 'SITREP' oder 'config'. Füge einen Claude-Schlüssel in CONFIG hinzu, um freie Fragen zu ermöglichen.", zh: "命令无法识别。请尝试 'AM Brief'、'PM Brief'、'SITREP' 或 'config'。在 CONFIG 中添加 Claude 密钥以启用自由问答。" },
  'error.loadfail':             { en: 'Failed to load file:',     es: 'Error al cargar archivo:',     de: 'Datei konnte nicht geladen werden:', zh: '文件加载失败：' },
  'sitrep.unavailable':         { en: 'Unavailable — check configuration or API key.', es: 'No disponible — verifica la configuración o la clave API.', de: 'Nicht verfügbar — Konfiguration oder API-Schlüssel prüfen.', zh: '不可用 — 请检查配置或 API 密钥。' },
  'sitrep.requires.key':        { en: 'Requires {keys} API key. Click CONFIG to add.', es: 'Requiere clave API de {keys}. Haz clic en CONFIG para agregarla.', de: 'Benötigt {keys}-API-Schlüssel. Klicke auf CONFIG, um ihn hinzuzufügen.', zh: '需要 {keys} API 密钥。点击 CONFIG 添加。' },
  'sitrep.requires.config':     { en: 'Requires configuration. Click CONFIG to set up.', es: 'Requiere configuración. Haz clic en CONFIG para configurar.', de: 'Konfiguration erforderlich. Klicke auf CONFIG zum Einrichten.', zh: '需要配置。点击 CONFIG 进行设置。' },

  // ── Widget names ─────────────────────────────────────────────────────────────
  'widget.weather.name':        { en: 'Weather',         es: 'Clima',          de: 'Wetter',           zh: '天气' },
  'widget.weather.temp':        { en: 'Temp',            es: 'Temp',           de: 'Temp',              zh: '温度' },
  'widget.weather.condition':   { en: 'Condition',       es: 'Condición',      de: 'Bedingung',         zh: '天气状况' },
  'widget.weather.outlook':     { en: '3-Day Outlook',   es: 'Perspectiva 3 días', de: '3-Tage-Ausblick', zh: '3日天气预报' },
  'widget.news.name':           { en: 'Intel',           es: 'Intel',          de: 'Intel',             zh: '情报' },
  'widget.calendar.name':       { en: "Today's Schedule", es: 'Agenda de Hoy', de: 'Heutiger Zeitplan', zh: '今日日程' },
  'widget.calendar.today':      { en: "Today's Schedule", es: 'Agenda de Hoy', de: 'Heutiger Zeitplan', zh: '今日日程' },
  'widget.calendar.tomorrow':   { en: "Tomorrow's Schedule", es: 'Agenda de Mañana', de: 'Morgiger Zeitplan', zh: '明日日程' },
  'widget.calendar.empty.today':    { en: 'No events scheduled today.',    es: 'No hay eventos programados hoy.',    de: 'Heute keine Termine geplant.',    zh: '今天没有计划活动。' },
  'widget.calendar.empty.tomorrow': { en: 'No events scheduled tomorrow.', es: 'No hay eventos programados mañana.', de: 'Morgen keine Termine geplant.',    zh: '明天没有计划活动。' },
  'widget.calendar.allday':     { en: 'All Day',         es: 'Todo el Día',    de: 'Ganztägig',         zh: '全天' },
  'widget.calendar.connect':    { en: 'Connect Google Calendar', es: 'Conectar Google Calendar', de: 'Google Kalender verbinden', zh: '连接 Google 日历' },
  'widget.markets.name':        { en: 'Markets',         es: 'Mercados',       de: 'Märkte',            zh: '市场' },
  'widget.bible.name':          { en: 'Word of the Day', es: 'Palabra del Día', de: 'Wort des Tages',   zh: '每日经文' },
  'widget.bible.title':         { en: 'Word of the Day \u2014 KJV', es: 'Palabra del Día \u2014 RV', de: 'Wort des Tages \u2014 KJV', zh: '每日经文 \u2014 KJV' },
  'widget.fitness.name':        { en: 'Fitness Tips',    es: 'Consejos de Fitness', de: 'Fitness-Tipps', zh: '健身建议' },
  'widget.fitness.noevents':    { en: 'No events scheduled today.', es: 'No hay eventos programados hoy.', de: 'Heute keine Termine.', zh: '今天没有计划活动。' },
  'widget.fitness.nofitness':   { en: 'No fitness events detected today.', es: 'No se detectaron eventos de fitness hoy.', de: 'Heute keine Fitnesseinträge erkannt.', zh: '今天未检测到健身活动。' },
  'widget.fitness.connectcal':  { en: 'Connect Google Calendar to enable fitness tips.', es: 'Conecta Google Calendar para habilitar consejos de fitness.', de: 'Google Kalender verbinden, um Fitness-Tipps zu aktivieren.', zh: '连接 Google 日历以启用健身建议。' },
  'widget.gmail.name':          { en: 'VIP Mail',        es: 'Correo VIP',     de: 'VIP-Mail',          zh: 'VIP 邮件' },
  'widget.gmail.connect':       { en: 'Connect Google Mail', es: 'Conectar Google Mail', de: 'Google Mail verbinden', zh: '连接 Google 邮件' },
  'widget.brief.name':          { en: 'Morning Brief',   es: 'Resumen Matutino', de: 'Morgenbericht',  zh: '早间简报' },
  'widget.brief.nodata':        { en: 'No data available for briefing.', es: 'No hay datos disponibles para el resumen.', de: 'Keine Daten für den Bericht verfügbar.', zh: '没有可用于简报的数据。' },
  'widget.music.name':          { en: 'Music',           es: 'Música',         de: 'Musik',             zh: '音乐' },
  'widget.music.none':          { en: 'No recent stories found.', es: 'No se encontraron historias recientes.', de: 'Keine aktuellen Berichte gefunden.', zh: '未找到最近的文章。' },
  'widget.sports.name':         { en: 'Sports',          es: 'Deportes',       de: 'Sport',             zh: '体育' },
  'widget.tasks.name':          { en: 'Tasks',           es: 'Tareas',         de: 'Aufgaben',          zh: '任务' },
  'widget.tasks.connect':       { en: 'Connect Google Tasks', es: 'Conectar Google Tasks', de: 'Google Tasks verbinden', zh: '连接 Google 任务' },
  'widget.traffic.name':        { en: 'Traffic',         es: 'Tráfico',        de: 'Verkehr',           zh: '交通' },
};
