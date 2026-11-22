import { classifyHost, hostnameOf } from "./official";
import type {
  Analysis,
  AnalysisInput,
  ChainStep,
  Evidence,
  Language,
  SchemeId,
  SourceCheck,
  Verdict,
} from "./types";

interface Hit {
  id: string;
  title: string;
  category:
    | "impersonation"
    | "pressure"
    | "money"
    | "channel"
    | "pretext"
    | "remote";
  quote: string;
}

const SENTENCE = /[^.!?\n]+[.!?]?/g;

function corpus(input: AnalysisInput): string {
  return [input.text, input.transcript, input.link]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function sentencesOf(text: string): string[] {
  const parts = text.match(SENTENCE)?.map((part) => part.trim()).filter(Boolean) ?? [];
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function quoteFor(text: string, pattern: RegExp): string | null {
  for (const sentence of sentencesOf(text)) {
    if (pattern.test(sentence)) {
      pattern.lastIndex = 0;
      const clean = sentence.replace(/\s+/g, " ").trim();
      return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
    }
    pattern.lastIndex = 0;
  }
  return null;
}

function has(text: string, pattern: RegExp): boolean {
  const found = pattern.test(text);
  pattern.lastIndex = 0;
  return found;
}

function detectLanguage(text: string): Language {
  const kk = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(text);
  const ru = /[ыэъёЫЭЪЁ]/.test(text);
  if (kk && ru) return "mixed";
  if (kk) return "kk";
  return "ru";
}

function extractPhones(text: string): string[] {
  const found = new Set<string>();
  const matches = text.match(/\+?\d[\d\s()-]{8,}\d/g) ?? [];
  for (const raw of matches) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) found.add(raw.replace(/\s+/g, " ").trim());
  }
  return [...found];
}

function extractHosts(text: string): string[] {
  const found = new Set<string>();
  const matches = text.match(/https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi) ?? [];
  for (const raw of matches) {
    const host = hostnameOf(raw);
    if (host) found.add(host);
  }
  return [...found];
}

const PATTERNS = {
  authority:
    /служб\p{L}* безопасност|сотрудник\p{L}* банк|поддержк\p{L}+ kaspi|национальн\p{L}+ банк|ұлттық банк|полици|участков|прокурат|оператор\p{L}* связ|қазақтелеком|kazakhtelecom/iu,
  egov: /e-?gov|электронн\p{L}+ правительств|портал\p{L}* госуслуг/iu,
  safeAccount: /безопасн\p{L}*\s+сч[её]т|резервн\p{L}*\s+сч[её]т|қорғалған шот/iu,
  revealCode:
    /назовите код|продиктуйте код|отправьте код|скиньте код|пришлите код|сообщите код|кодты айтыңыз|кодты жібер/i,
  otpNotice: /код[:\s№#-]*\d{4,8}|\b\d{4,8}\b[^.\n]{0,24}код/i,
  bankProtectsCode: /не сообщайте код|никому не сообщайте код|коды? и перевод/i,
  transfer:
    /переведи(?:те)?|перевести|перевод на|жібер(?:іңіз|індер)?|ақша жібер|теңге жібер|внесите|пополните депозит|предоплат|алдын ала төлем/i,
  secrecy:
    /никому не (?:говори|рассказыва|сообщай)|ешкімге айтпа|папа будет|әкең білмесін|это между нами/i,
  urgency: /срочно|немедленно|шұғыл|тез арада|мест мало|сегодня ещё/i,
  family: /мама|папа|сынок|доченьк|братик|балаң|анам|әкем|ағам|қарындас/i,
  newNumber: /нов(?:ого|ый|ым) номер|жаңа нөмір|телефон разбил|телефоным сынып|пишу с друг/i,
  emergency: /больниц|аурухана|авария|дтп|срочн\p{L}+ нужн\p{L}+ оплат/iu,
  investment: /гарантированн\p{L}+ доход|% в день|инвест(?:иционн\p{L}+)? платформ|пассивн\p{L}+ доход|тәулігіне/iu,
  depositAsk: /внесите|депозит|пополн\p{L}+ сч[её]т|инвестир/iu,
  marketplace: /olx|kolesa|колеса|крыша\.kz|казпочт|объявлен/i,
  prepay: /предоплат|алдын ала төлем/i,
  remote: /anydesk|rustdesk|teamviewer|удал[её]нн\p{L}+ доступ/iu,
  confirmLogin: /подтвердите операц|личн\p{L}+ кабинет|жеке кабинет|войдите по ссылк/iu,
  bankBrand: /kaspi|halyk|homebank|халык|банк/i,
};

function pushHit(hits: Hit[], text: string, hit: Omit<Hit, "quote">, pattern: RegExp) {
  const quote = quoteFor(text, pattern);
  if (!quote) return;
  if (hits.some((item) => item.id === hit.id)) return;
  hits.push({ ...hit, quote });
}

const SCHEME_COPY: Record<
  SchemeId,
  { title: string; summary: string; summaryKk: string; steps: string[] }
> = {
  safe_account: {
    title: "Цепочка давления и «безопасный счёт»",
    summary:
      "Собеседник представляется банком, полицией или госорганом и ведёт к переводу, коду из SMS или «безопасному счёту». Это одна схема, даже если номер звонка нигде не числится.",
    summaryKk:
      "Әңгімелесуші өзін банк, полиция немесе мемлекет қызметкері ретінде көрсетіп, аудармаға, SMS-кодқа немесе «қауіпсіз шотқа» итермелейді.",
    steps: [
      "Положите трубку. Сотрудник банка, полиции и Нацбанка не просит перевести деньги на «безопасный счёт» и не диктует это в мессенджере.",
      "Откройте приложение своего банка сами или позвоните по номеру на обратной стороне карты.",
      "По eGov заходите только набрав egov.kz или через приложение eGov mobile. Справочная: 1414.",
      "Консультация Национального банка: 1477. Нацбанк не звонит клиентам и не обслуживает их счета.",
    ],
  },
  relative_emergency: {
    title: "Родственник с нового номера",
    summary:
      "Голос или текст просит деньги от лица близкого, с нового номера, с просьбой никому не говорить. Знакомый голос и чистое имя номера эту схему не отменяют.",
    summaryKk:
      "Жақын адамның атынан, жаңа нөмірден, ешкімге айтпауды өтініп ақша сұрап тұр. Дауыс таныс болып көрінсе де, ескі сақталған нөмірге өзіңіз қоңырау шалыңыз.",
    steps: [
      "Не переводите деньги с этого чата.",
      "Позвоните родственнику на номер, который был сохранён раньше, или спросите то, чего нет в переписке.",
      "Если человек на линии просит не вешать трубку — как раз положите её и перезвоните сами.",
    ],
  },
  fake_investment: {
    title: "Фиктивная инвестиционная платформа",
    summary:
      "Обещают доход и просят внести деньги по ссылке из переписки. Площадка собирается из обещания прибыли и просьбы о переводе, а не из одного слова «инвестиции».",
    summaryKk:
      "Пайда уәде етіп, хат алмасудағы сілтеме арқылы ақша салуды сұрайды. Сілтемені ашпаңыз және ақша аудармаңыз.",
    steps: [
      "Не переводите деньги и не устанавливайте приложение по ссылке из сообщения.",
      "Название платформы проверьте сами через сайт Агентства по регулированию и развитию финансового рынка.",
      "Гарантированный ежедневный процент — признак схемы, а не оферта.",
    ],
  },
  marketplace_prepay: {
    title: "Предоплата незнакомому продавцу",
    summary:
      "В объявлении просят предоплату на карту до передачи товара. Здесь нет слов «срочно» и «мошенники», но связка «доставка + предоплата на чужой Kaspi» — отдельная схема.",
    summaryKk:
      "Хабарландыруда тауарды бермей тұрып бөтен картаға алдын ала төлем сұралады. Кездескенде немесе ресми жеткізумен төлеңіз.",
    steps: [
      "Не переводите предоплату на карту из чата.",
      "Оплата при встрече или официальная доставка, где платёж проходит в приложении площадки.",
      "Номер карты из этого сообщения для проверки продавца не подходит.",
    ],
  },
  phishing_link: {
    title: "Поддельная ссылка на официальный сервис",
    summary:
      "Адрес притворяется банком или eGov: официальное имя стоит в начале или внутри чужого домена. Открывать такую страницу и вводить код нельзя.",
    summaryKk:
      "Сілтеме банкке немесе eGov-қа ұқсайды, бірақ домен бөтен. Бетті ашпаңыз және код енгізбеңіз. Мекенжайды өзіңіз теріңіз.",
    steps: [
      "Не вводите пароль и код на странице из сообщения.",
      "Адрес банка или egov.kz наберите вручную либо откройте сохранённое приложение.",
      "Совпадение первых букв адреса с настоящим сайтом ничего не подтверждает.",
    ],
  },
  remote_access: {
    title: "Удалённый доступ к телефону",
    summary:
      "Под видом поддержки просят поставить AnyDesk, RustDesk или аналог и продиктовать код. После этого телефон и банк оказываются у другого человека.",
    summaryKk:
      "Қолдау қызметі атынан AnyDesk немесе соған ұқсас бағдарлама орнатып, кодты айтуды сұрайды. Орнатпаңыз.",
    steps: [
      "Не устанавливайте программу удалённого доступа по просьбе из звонка или чата.",
      "Не диктуйте код с экрана.",
      "В банк входите только через его приложение, которое поставили сами из официального магазина.",
    ],
  },
};

const CALM_SUMMARY = {
  title: "Признаков целой схемы нет",
  summary:
    "В тексте нет связки «кто представляется + чего добивается». Спокойный разбор не доказывает, что сообщение безопасно: если дальше попросят код, перевод или установку приложения — остановитесь.",
  summaryKk:
    "Мәтіннен тұтас алаяқтық сұлба көрінбейді. Бұл хабардың қауіпсіз екенін дәлелдемейді.",
};

const SUSPICIOUS_SUMMARY = {
  title: "Есть отдельный риск, схемы целиком нет",
  summary:
    "Одного следа мало, чтобы назвать это схемой. Деньги и коды по этому сообщению лучше не отправлять, пока не подтвердите просьбу своим каналом.",
  summaryKk: "Бір ғана белгі бар. Ақша мен кодты жібермес бұрын өз арнаңызбен тексеріңіз.",
};

function safeStepsFor(schemeId: SchemeId | null, verdict: Verdict): string[] {
  if (verdict === "calm") {
    return [
      "Если следующим сообщением попросят код, перевод или установку приложения — это уже другой разбор, пришлите и его.",
      "Ссылки открывайте набором адреса вручную, не из цепочки, где вас торопят.",
    ];
  }
  if (!schemeId || verdict === "suspicious") {
    return [
      "Не переводите деньги и не называйте код из SMS по этому сообщению.",
      "Подтвердите просьбу каналом, который открыли вы: сохранённый номер, приложение банка, набор адреса вручную.",
    ];
  }
  return SCHEME_COPY[schemeId].steps;
}

const NOT_CHECKED = [
  "Номер не сверялся с базой оператора и антифрод-центра. Чистый номер схему не отменяет.",
  "Голос не проверялся: запись может быть живой или собранной.",
  "Движение денег по счёту отсюда не видно — это контур банка.",
  "Скриншот интерфейса не доказывает, что окно настоящее.",
];

export function analyze(input: AnalysisInput): Analysis {
  const text = corpus(input);
  const language = detectLanguage(text);
  const phones = extractPhones(text);
  const domains = extractHosts(text);
  const hits: Hit[] = [];

  const codeIsProtective =
    has(text, PATTERNS.otpNotice) &&
    has(text, PATTERNS.bankProtectsCode) &&
    !has(text, PATTERNS.revealCode);

  if (has(text, PATTERNS.authority)) {
    pushHit(hits, text, { id: "authority", title: "Представляется организацией", category: "impersonation" }, PATTERNS.authority);
  }
  if (has(text, PATTERNS.safeAccount)) {
    pushHit(hits, text, { id: "safe-account", title: "Просит «безопасный счёт»", category: "money" }, PATTERNS.safeAccount);
  }
  if (has(text, PATTERNS.revealCode)) {
    pushHit(hits, text, { id: "reveal-code", title: "Просит назвать код", category: "money" }, PATTERNS.revealCode);
  }
  if (has(text, PATTERNS.transfer) && !codeIsProtective) {
    pushHit(hits, text, { id: "transfer", title: "Просит перевод или взнос", category: "money" }, PATTERNS.transfer);
  }
  if (has(text, PATTERNS.secrecy) && !codeIsProtective) {
    pushHit(hits, text, { id: "secrecy", title: "Просит молчать", category: "pressure" }, PATTERNS.secrecy);
  }
  if (has(text, PATTERNS.urgency)) {
    pushHit(hits, text, { id: "urgency", title: "Подгоняет", category: "pressure" }, PATTERNS.urgency);
  }
  if (has(text, PATTERNS.family) && (has(text, PATTERNS.newNumber) || has(text, PATTERNS.emergency) || has(text, PATTERNS.secrecy))) {
    pushHit(hits, text, { id: "relative", title: "Пишет от лица близкого", category: "pretext" }, PATTERNS.family);
  }
  if (has(text, PATTERNS.newNumber)) {
    pushHit(hits, text, { id: "new-number", title: "Новый или сломанный номер", category: "channel" }, PATTERNS.newNumber);
  }
  if (has(text, PATTERNS.emergency)) {
    pushHit(hits, text, { id: "emergency", title: "История про беду", category: "pretext" }, PATTERNS.emergency);
  }
  if (has(text, PATTERNS.investment)) {
    pushHit(hits, text, { id: "profit", title: "Обещает доход", category: "pretext" }, PATTERNS.investment);
  }
  if (has(text, PATTERNS.marketplace) && has(text, PATTERNS.prepay)) {
    pushHit(hits, text, { id: "listing", title: "Переписка по объявлению", category: "pretext" }, PATTERNS.marketplace);
    pushHit(hits, text, { id: "prepay", title: "Предоплата до товара", category: "money" }, PATTERNS.prepay);
  }
  if (has(text, PATTERNS.remote)) {
    pushHit(hits, text, { id: "remote", title: "Программа удалённого доступа", category: "remote" }, PATTERNS.remote);
  }

  const sourceChecks: SourceCheck[] = [];
  let lookalikeQuote: string | null = null;
  for (const host of domains) {
    const kind = classifyHost(host);
    if (kind === "official") {
      sourceChecks.push({
        label: host,
        detail: "Домен совпадает с официальным. Это не делает остальной текст безопасным.",
        status: "ok",
      });
    } else if (kind === "lookalike") {
      sourceChecks.push({
        label: host,
        detail: "Похоже на банк или госсайт, но адрес чужой. Официальное имя стоит внутри или в начале.",
        status: "risk",
      });
      lookalikeQuote = lookalikeQuote ?? host;
    } else {
      sourceChecks.push({
        label: host,
        detail: "Это не официальный домен банка или eGov. Откуда ведёт страница, отсюда не видно.",
        status: "unknown",
      });
    }
  }
  if (lookalikeQuote) {
    hits.push({
      id: "lookalike",
      title: "Ссылка маскируется под официальную",
      category: "channel",
      quote: lookalikeQuote,
    });
    if (has(text, PATTERNS.confirmLogin) || has(text, PATTERNS.authority)) {
      pushHit(
        hits,
        text,
        { id: "confirm-link", title: "Просит подтвердить действие по этой ссылке", category: "impersonation" },
        has(text, PATTERNS.confirmLogin) ? PATTERNS.confirmLogin : PATTERNS.authority,
      );
    }
  }
  if (phones.length > 0 && (has(text, PATTERNS.transfer) || has(text, PATTERNS.prepay) || has(text, PATTERNS.safeAccount))) {
    hits.push({
      id: "phone-in-ask",
      title: "Номер для денег взят из этого же сообщения",
      category: "channel",
      quote: phones[0],
    });
    sourceChecks.push({
      label: phones[0],
      detail: "Номер стоит в просьбе о переводе. Для проверки он не используется.",
      status: "risk",
    });
  }

  if (input.hasImage) {
    sourceChecks.push({
      label: "Скриншот",
      detail: "Картинка приложена. Подлинность интерфейса на ней не устанавливается.",
      status: "unknown",
    });
  }
  if (input.hasAudio) {
    sourceChecks.push({
      label: "Аудио",
      detail: "Разбор идёт по расшифровке. Синтетический ли голос — не проверялось.",
      status: "unknown",
    });
  }

  const chain: ChainStep[] = [];
  if (has(text, /служб\p{L}* безопасност|поддержк\p{L}+ kaspi|сотрудник\p{L}* банк/iu)) {
    chain.push({ id: "bank", label: "«Служба банка»" });
  }
  if (has(text, PATTERNS.egov) || has(text, /кредит/i)) {
    chain.push({ id: "credit", label: "Кредит или eGov" });
  }
  if (has(text, /полици|участков|прокурат/i)) {
    chain.push({ id: "police", label: "«Полиция»" });
  }
  if (has(text, PATTERNS.safeAccount)) {
    chain.push({ id: "safe", label: "«Безопасный счёт»" });
  }

  const categories = new Set(hits.map((hit) => hit.category));
  const scores: Record<SchemeId, number> = {
    safe_account: 0,
    relative_emergency: 0,
    fake_investment: 0,
    marketplace_prepay: 0,
    phishing_link: 0,
    remote_access: 0,
  };

  if (categories.has("impersonation") && (hits.some((hit) => hit.id === "safe-account" || hit.id === "reveal-code") || chain.length >= 3)) {
    scores.safe_account += 5;
  }
  if (categories.has("impersonation") && hits.some((hit) => hit.id === "transfer")) scores.safe_account += 3;
  if (chain.length >= 3) scores.safe_account += 2;

  const relativeAnomaly = hits.some((hit) => hit.id === "new-number" || hit.id === "emergency" || hit.id === "secrecy");
  if (hits.some((hit) => hit.id === "relative") && hits.some((hit) => hit.id === "transfer") && relativeAnomaly) {
    scores.relative_emergency += 6;
  }

  if (hits.some((hit) => hit.id === "profit") && (hits.some((hit) => hit.id === "transfer") || domains.length > 0)) {
    scores.fake_investment += 6;
  }

  if (hits.some((hit) => hit.id === "prepay")) scores.marketplace_prepay += 6;

  if (hits.some((hit) => hit.id === "lookalike") && (has(text, PATTERNS.confirmLogin) || has(text, PATTERNS.bankBrand) || has(text, PATTERNS.authority))) {
    scores.phishing_link += 5;
  }

  if (hits.some((hit) => hit.id === "remote") && (hits.some((hit) => hit.id === "reveal-code") || categories.has("impersonation"))) {
    scores.remote_access += 7;
  }

  const ranked = (Object.entries(scores) as [SchemeId, number][]).sort((a, b) => b[1] - a[1]);
  const [topScheme, topScore] = ranked[0];
  const independent = categories.size;

  let verdict: Verdict = "calm";
  let schemeId: SchemeId | null = null;
  if (topScore >= 5 && independent >= 2) {
    verdict = "scheme";
    schemeId = topScheme;
  } else if (independent >= 1 && hits.some((hit) => hit.category === "money" || hit.category === "channel" || hit.category === "remote")) {
    verdict = "suspicious";
  }

  if (codeIsProtective && topScore < 5) {
    verdict = "calm";
    schemeId = null;
  }

  const copy =
    verdict === "scheme" && schemeId
      ? SCHEME_COPY[schemeId]
      : verdict === "suspicious"
        ? SUSPICIOUS_SUMMARY
        : CALM_SUMMARY;

  const evidence: Evidence[] = [];
  const seenQuotes = new Set<string>();
  for (const hit of hits) {
    const key = hit.quote.replace(/\s+/g, " ").trim().toLowerCase();
    if (seenQuotes.has(key)) continue;
    seenQuotes.add(key);
    evidence.push({ id: hit.id, title: hit.title, quote: hit.quote });
    if (evidence.length === 5) break;
  }

  const confidence =
    verdict === "scheme" && independent >= 3 ? "высокая" : verdict === "scheme" ? "средняя" : "ограниченная";

  const showChain = schemeId === "safe_account" && chain.length >= 2 ? chain : [];

  return {
    verdict,
    schemeId,
    title: copy.title,
    summary: copy.summary,
    summaryKk: language === "ru" ? null : copy.summaryKk,
    confidence,
    language,
    evidence: verdict === "calm" ? evidence.filter((item) => item.id === "lookalike") : evidence,
    chain: showChain,
    sourceChecks,
    safeSteps: safeStepsFor(schemeId, verdict),
    notChecked: NOT_CHECKED,
    groups: independent,
    phones,
    domains,
  };
}

export function attackerResidue(input: AnalysisInput, steps: string[]): string[] {
  const blob = steps.join("\n").toLowerCase();
  const leaked: string[] = [];
  for (const phone of extractPhones(corpus(input))) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10 && blob.includes(digits)) leaked.push(phone);
  }
  for (const host of extractHosts(corpus(input))) {
    if (classifyHost(host) !== "official" && blob.includes(host.toLowerCase())) leaked.push(host);
  }
  return leaked;
}
