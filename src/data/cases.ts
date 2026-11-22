import type { SchemeId, Verdict } from "../engine/types";

export interface DemoCase {
  id: string;
  title: string;
  group: "схема" | "замаскировано" | "спокойно";
  text: string;
  link?: string;
  transcript?: string;
  verdict: Verdict;
  schemeId: SchemeId | null;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "safe-account",
    title: "Безопасный счёт",
    group: "схема",
    verdict: "scheme",
    schemeId: "safe_account",
    text: "Это служба безопасности Halyk. На вас оформили кредит через eGov. Сейчас переключу на сотрудника полиции. Для отмены переведите деньги на безопасный счёт Национального банка. Никому не рассказывайте, иначе счёт заблокируют. Перевод на +7 707 000 14 32.",
    link: "https://halyk-security-check.com/account",
  },
  {
    id: "relative-ru",
    title: "Мама, новый номер",
    group: "схема",
    verdict: "scheme",
    schemeId: "relative_emergency",
    transcript:
      "Сынок, это мама. Телефон разбила, пишу с нового номера. Попала в больницу, срочно нужно оплатить. Никому не говори, папа будет волноваться. Переведи 80 000 на Kaspi +7 747 000 22 10.",
    text: "",
  },
  {
    id: "relative-kk",
    title: "Туыс, қазақша",
    group: "схема",
    verdict: "scheme",
    schemeId: "relative_emergency",
    text: "Мама, бұл мен, балаң. Телефоным сынып қалды, жаңа нөмірден жазып тұрмын. Ауруханаға түстім, шұғыл 60 000 теңге жібер. Ешкімге айтпа. Kaspi: +7 701 000 55 17",
  },
  {
    id: "invest",
    title: "Инвестплатформа",
    group: "схема",
    verdict: "scheme",
    schemeId: "fake_investment",
    text: "Платформа Qazaq Oil Invest. Гарантированный доход 4% в день. Внесите от 50 000, мест мало.",
    link: "https://qazaq-oil-invest.com/deposit",
  },
  {
    id: "olx",
    title: "OLX без спешки",
    group: "замаскировано",
    verdict: "scheme",
    schemeId: "marketplace_prepay",
    text: "Здравствуйте! По объявлению холодильник есть. Я в Караганде, отправлю Казпочтой. Нужна предоплата 50% на Kaspi Gold +7 776 000 30 18.",
  },
  {
    id: "lookalike",
    title: "Ссылка «как eGov»",
    group: "замаскировано",
    verdict: "scheme",
    schemeId: "phishing_link",
    text: "Halyk Bank. Подтвердите операцию в личном кабинете.",
    link: "https://egov.kz.halyk-confirm.info/login",
  },
  {
    id: "anydesk",
    title: "AnyDesk",
    group: "схема",
    verdict: "scheme",
    schemeId: "remote_access",
    text: "Это поддержка Kaspi. Установите AnyDesk и продиктуйте код доступа, мы отменим кредит.",
  },
  {
    id: "code-ask",
    title: "Назовите код",
    group: "схема",
    verdict: "scheme",
    schemeId: "safe_account",
    text: "Служба безопасности банка. Назовите код из SMS, чтобы отменить заявку на кредит.",
  },
  {
    id: "friend-transfer",
    title: "Один перевод",
    group: "замаскировано",
    verdict: "suspicious",
    schemeId: null,
    text: "Можешь перевести 5 000 на карту до вечера? Я на месте отдам.",
  },
  {
    id: "kaspi-otp",
    title: "Код Kaspi",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Kaspi.kz: код 482193 для входа. Никому не сообщайте код.",
  },
  {
    id: "delivery",
    title: "Доставка",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Kaspi Доставка: заказ 184220 передан курьеру. Отслеживание в приложении Kaspi.",
  },
  {
    id: "homebank",
    title: "Вход в Homebank",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Обнаружен вход в Homebank с нового устройства. Если это были не вы, войдите в приложение Halyk и завершите сессию. Банк не просит коды и переводы по телефону.",
  },
  {
    id: "clinic-kk",
    title: "Емхана",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Емхана: ертең сағат 10:30-да терапевт қабылдауы. Келмесеңіз, 1414 нөміріне хабарласыңыз.",
  },
  {
    id: "borrow",
    title: "Обычная просьба",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Привет, можешь занять до пятницы?",
  },
  {
    id: "official-link",
    title: "Ровно egov.kz",
    group: "спокойно",
    verdict: "calm",
    schemeId: null,
    text: "Статус заявления смотрите в личном кабинете.",
    link: "https://egov.kz/",
  },
];
