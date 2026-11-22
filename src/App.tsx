import { useMemo, useRef, useState } from "react";
import { DEMO_CASES, type DemoCase } from "./data/cases";
import { analyze, attackerResidue } from "./engine/analyze";
import type { Analysis, AnalysisInput, Verdict } from "./engine/types";
import { readScreenshot } from "./ocr";

type Mode = "review" | "bench";
type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function speechCtor(): SpeechCtor | null {
  const host = window as Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function verdictLabel(verdict: Verdict): string {
  if (verdict === "scheme") return "Схема";
  if (verdict === "suspicious") return "Подозрительно";
  return "Спокойно";
}

export function App() {
  const [mode, setMode] = useState<Mode>("review");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [transcript, setTranscript] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("ru-RU");
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const dossierRef = useRef<HTMLElement>(null);
  const listeningRef = useRef<{ stop: () => void } | null>(null);

  const filled = text.trim() || link.trim() || transcript.trim() || imageUrl || hasAudio;

  function currentInput(patch?: Partial<AnalysisInput>): AnalysisInput {
    return {
      text,
      link,
      transcript,
      hasImage: Boolean(imageUrl),
      hasAudio,
      ...patch,
    };
  }

  function publish(input: AnalysisInput) {
    setResult(analyze(input));
    if (window.innerWidth <= 860) {
      requestAnimationFrame(() => dossierRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function applyCase(item: DemoCase) {
    setActiveCase(item.id);
    setText(item.text);
    setLink(item.link ?? "");
    setTranscript(item.transcript ?? "");
    setHasAudio(Boolean(item.transcript));
    setImageUrl(null);
    setImageName(null);
    setStatus(item.transcript ? "Разбор идёт по расшифровке голосового. Голос на подлинность не проверяется." : null);
    setMode("review");
    publish({
      text: item.text,
      link: item.link,
      transcript: item.transcript,
      hasAudio: Boolean(item.transcript),
      hasImage: false,
    });
  }

  function onAnalyze() {
    if (!text.trim() && !link.trim() && !transcript.trim()) {
      setStatus("Нужен текст, ссылка или расшифровка. По одному скриншоту схему не собрать.");
      setResult(null);
      return;
    }
    setActiveCase(null);
    publish(currentInput());
  }

  async function onImage(file: File) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageName(file.name);
    setStatus("Читаем текст на скриншоте…");
    try {
      const recognized = await readScreenshot(file);
      if (!recognized) {
        setStatus("На скриншоте не удалось прочитать текст. Вставьте его вручную.");
        return;
      }
      const nextText = text.trim() ? `${text.trim()}\n${recognized}` : recognized;
      setText(nextText);
      setStatus("Текст со скриншота добавлен в разбор. Подлинность самого окна не проверяется.");
      publish({ ...currentInput(), text: nextText, hasImage: true });
    } catch {
      setStatus("Скриншот приложен, но распознавание не ответило. Вставьте текст с картинки.");
    }
  }

  function toggleListen() {
    if (listeningRef.current) {
      listeningRef.current.stop();
      listeningRef.current = null;
      setListening(false);
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) {
      setStatus("В этом браузере нет диктовки. Вставьте расшифровку голосового вручную.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = speechLang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const said = Array.from(event.results)
        .map((row) => row[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!said) return;
      const next = transcript.trim() ? `${transcript.trim()} ${said}` : said;
      setTranscript(next);
      setHasAudio(true);
      setStatus("Диктовка записана как расшифровка. Синтетический ли голос — не проверялось.");
      publish({ ...currentInput(), transcript: next, hasAudio: true });
    };
    recognition.onerror = () => {
      setListening(false);
      listeningRef.current = null;
      setStatus("Диктовка прервалась. Можно вставить текст голосового вручную.");
    };
    recognition.onend = () => {
      setListening(false);
      listeningRef.current = null;
    };
    listeningRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Shield />
          <div>
            <strong>Qalqan</strong>
            <span>Verify</span>
          </div>
        </div>
        <p className="tag">Разбор схемы до перевода</p>
        <nav>
          <button type="button" className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>
            Разбор
          </button>
          <button type="button" className={mode === "bench" ? "on" : ""} onClick={() => setMode("bench")}>
            Набор · {DEMO_CASES.length}
          </button>
        </nav>
      </header>

      {mode === "bench" ? (
        <Bench />
      ) : (
        <main>
          <section className="panel composer">
            <div className="panel-head">
              <h1>Что пришло</h1>
              <p>Сообщение, голосовое, скриншот или ссылка. Номер отдельно не проверяется.</p>
            </div>

            <label className="field">
              <span>Текст сообщения</span>
              <textarea
                value={text}
                placeholder="Вставьте переписку или текст со скриншота"
                onChange={(event) => setText(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Ссылка, если она была</span>
              <input
                value={link}
                placeholder="https://"
                onChange={(event) => setLink(event.target.value)}
                inputMode="url"
              />
            </label>

            <label className="field">
              <span>Расшифровка голосового</span>
              <textarea
                className="short"
                value={transcript}
                placeholder="Что сказано в голосовом или на записи"
                onChange={(event) => {
                  setTranscript(event.target.value);
                  setHasAudio(Boolean(event.target.value.trim()) || hasAudio);
                }}
              />
            </label>

            <div className="tools">
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                Скриншот
              </button>
              <button type="button" className="ghost" onClick={() => audioRef.current?.click()}>
                Аудиофайл
              </button>
              <button type="button" className={listening ? "ghost hot" : "ghost"} onClick={toggleListen}>
                {listening ? "Слушаю…" : "Надиктовать"}
              </button>
              <select value={speechLang} onChange={(event) => setSpeechLang(event.target.value)} aria-label="Язык диктовки">
                <option value="ru-RU">Русский</option>
                <option value="kk-KZ">Қазақша</option>
              </select>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onImage(file);
                  event.target.value = "";
                }}
              />
              <input
                ref={audioRef}
                hidden
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setHasAudio(true);
                  setStatus(`«${file.name}» приложен. Вставьте расшифровку: файл здесь не превращается в текст, и голос на подделку не проверяется.`);
                  event.target.value = "";
                }}
              />
            </div>

            {imageUrl && (
              <figure className="shot">
                <img src={imageUrl} alt={imageName ?? "Скриншот"} />
                <figcaption>{imageName}</figcaption>
              </figure>
            )}

            {status && <p className="status">{status}</p>}

            <button type="button" className="primary" onClick={onAnalyze} disabled={!filled}>
              Разобрать
            </button>

            <div className="cases">
              <p>Показать на примере</p>
              <div className="chips">
                {DEMO_CASES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={activeCase === item.id ? "chip on" : "chip"}
                    onClick={() => applyCase(item)}
                  >
                    <small>{item.group}</small>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel dossier" aria-live="polite" ref={dossierRef}>
            {result ? <Dossier result={result} /> : <EmptyDossier />}
          </section>
        </main>
      )}
    </div>
  );
}

function EmptyDossier() {
  return (
    <div className="empty">
      <p className="eyebrow">Досье</p>
      <h2>Схема, а не номер</h2>
      <ol>
        <li>Кто представляется и чего добивается.</li>
        <li>Какие следы независимы: давление, деньги, чужая ссылка, новый номер.</li>
        <li>Как проверить это каналом, которого нет в сообщении.</li>
      </ol>
      <p className="aside">Чистый номер схему не отменяет. Qalqan его специально не спрашивает.</p>
    </div>
  );
}

function Dossier({ result }: { result: Analysis }) {
  return (
    <article className={`dossier-body ${result.verdict}`}>
      <p className="eyebrow">Досье · уверенность {result.confidence}</p>
      <div className={`verdict ${result.verdict}`}>{verdictLabel(result.verdict)}</div>
      <h2>{result.title}</h2>
      <p className="summary">{result.summary}</p>
      {result.summaryKk && <p className="summary kk">{result.summaryKk}</p>}

      {result.verdict === "scheme" && (
        <p className="compare">Проверка номера здесь ничего не решает: в разборе его нет специально. Следов: {result.evidence.length}, независимых групп: {result.groups}.</p>
      )}

      {result.chain.length > 0 && (
        <div className="chain">
          {result.chain.map((step) => (
            <span key={step.id}>{step.label}</span>
          ))}
        </div>
      )}

      {result.evidence.length > 0 && (
        <section>
          <h3>Следы</h3>
          <ul className="evidence">
            {result.evidence.map((item, index) => (
              <li key={item.id}>
                <em>{index + 1}</em>
                <div>
                  <strong>{item.title}</strong>
                  <q>{item.quote}</q>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.sourceChecks.length > 0 && (
        <section>
          <h3>Что видно по источнику</h3>
          <ul className="checks">
            {result.sourceChecks.map((item) => (
              <li key={`${item.label}-${item.detail}`} className={item.status}>
                <b>{item.label}</b>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Как проверить безопасно</h3>
        <ol className="steps">
          {result.safeSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section>
        <h3>Это не проверялось</h3>
        <ul className="unchecked">
          {result.notChecked.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Bench() {
  const rows = useMemo(
    () =>
      DEMO_CASES.map((item) => {
        const input = { text: item.text, link: item.link, transcript: item.transcript };
        const result = analyze(input);
        const leaked = attackerResidue(input, result.safeSteps);
        const pass =
          result.verdict === item.verdict &&
          result.schemeId === item.schemeId &&
          (item.verdict !== "scheme" || (result.evidence.length >= 2 && result.groups >= 2)) &&
          leaked.length === 0;
        return { item, result, pass };
      }),
    [],
  );
  const passed = rows.filter((row) => row.pass).length;

  return (
    <section className="bench">
      <div className="bench-head">
        <div>
          <p className="eyebrow">Один и тот же разбор, что на экране</p>
          <h1>
            {passed} из {rows.length} сходятся с разметкой
          </h1>
        </div>
        <p>
          Для схемы нужны минимум два независимых следа. Рекомендация не должна возвращать к номеру или ссылке из сообщения. Спокойные сообщения банка и доставки остаются спокойными.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Кейс</th>
              <th>Ожидание</th>
              <th>Разбор</th>
              <th>Следы</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item.id}>
                <td>
                  <strong>{row.item.title}</strong>
                  <small>{row.item.group}</small>
                </td>
                <td>{verdictLabel(row.item.verdict)}</td>
                <td>{row.result.title}</td>
                <td>{row.result.evidence.length}</td>
                <td className={row.pass ? "pass" : "fail"}>{row.pass ? "сходится" : "мимо"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Shield() {
  return (
    <svg className="shield" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5 27 7.4v8.8c0 6.2-4.2 10.2-11 12.6C9.2 26.4 5 22.4 5 16.2V7.4L16 3.5Z" />
      <path d="M11.2 16.1 14.5 19.4 21.2 12.6" className="tick" />
    </svg>
  );
}
