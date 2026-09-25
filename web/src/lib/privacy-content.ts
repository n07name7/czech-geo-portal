export type PrivacySection = { title: string; paragraphs: string[] };
export type PrivacyContent = { eyebrow: string; title: string; lead: string; updated: string; sections: PrivacySection[] };

const CONTENT: Record<"cs" | "en" | "ru", PrivacyContent> = {
  cs: {
    eyebrow: "Transparentnost",
    title: "Data a soukromí",
    lead: "Co se děje s adresou, kterou zadáte, a jaké jsou hranice tohoto nástroje.",
    updated: "Beta verze · aktualizováno 12. září 2026",
    sections: [
      { title: "Jaká data zadáváte", paragraphs: ["Při hledání odesíláte adresu službě Photon, která používá data OpenStreetMap. Pro výpočet reportu pracujeme se souřadnicemi vybraného místa. Nezadávejte do vyhledávání jména osob ani jiné zbytečné osobní údaje."] },
      { title: "Externí služby", paragraphs: ["Souřadnice mohou být předány službám OpenStreetMap / Overpass (místa a upozornění v okolí), Valhalla (orientační dostupnost po síti) a CENIA (povodňové ohrožení). Web je hostovaný na Vercel, který zpracovává běžné technické údaje požadavku, například IP adresu a user-agent."] },
      { title: "Účty, platby a ukládání", paragraphs: ["Beta verze nevytváří uživatelské účty a platby jsou vypnuté. Aplikace nyní neukládá historii zadaných adres do vlastní uživatelské databáze. Technické logy hostingu a externích služeb se řídí pravidly jejich provozovatelů."] },
      { title: "Hranice výsledku", paragraphs: ["Report hodnotí okolí adresy, nikoli technický nebo právní stav nemovitosti. Nejde o úřední dokument ani záruku bezpečnosti, dostupnosti služeb nebo absence rizika. Veřejná data mohou být neúplná nebo zastaralá; období jednotlivých zdrojů uvádíme v metodologii."] },
    ],
  },
  en: {
    eyebrow: "Transparency",
    title: "Data and privacy",
    lead: "What happens to an address you enter and where this tool's responsibility ends.",
    updated: "Beta · updated 12 September 2026",
    sections: [
      { title: "Data you enter", paragraphs: ["Address searches are sent to Photon, which uses OpenStreetMap data. The report then uses the coordinates of the selected location. Do not enter people's names or unnecessary personal information in the search field."] },
      { title: "External services", paragraphs: ["Coordinates may be sent to OpenStreetMap / Overpass (nearby places and watch-outs), Valhalla (approximate network reach) and CENIA (flood hazard). The site is hosted on Vercel, which processes ordinary request metadata such as IP address and user-agent."] },
      { title: "Accounts, payments and storage", paragraphs: ["The beta does not create user accounts and payments are disabled. The application currently does not store a history of entered addresses in its own user database. Hosting and external-service logs follow each provider's policies."] },
      { title: "Limits of the result", paragraphs: ["The report evaluates an address's surroundings, not the property's technical or legal condition. It is not an official document or a guarantee of safety, service availability or absence of risk. Public data can be incomplete or outdated; source periods are listed in the methodology."] },
    ],
  },
  ru: {
    eyebrow: "Прозрачность",
    title: "Данные и конфиденциальность",
    lead: "Что происходит с введённым адресом и где заканчивается ответственность инструмента.",
    updated: "Бета-версия · обновлено 12 сентября 2026 года",
    sections: [
      { title: "Какие данные вы вводите", paragraphs: ["Поисковый запрос с адресом передаётся сервису Photon, использующему данные OpenStreetMap. Затем отчёт обрабатывает координаты выбранного места. Не вводите в поиск имена людей или другие лишние персональные данные."] },
      { title: "Внешние сервисы", paragraphs: ["Координаты могут передаваться OpenStreetMap / Overpass (объекты и факторы рядом), Valhalla (ориентировочная доступность по дорожной сети) и CENIA (угроза наводнений). Сайт размещён на Vercel, который обрабатывает обычные технические данные запроса, например IP-адрес и user-agent."] },
      { title: "Аккаунты, платежи и хранение", paragraphs: ["Бета-версия не создаёт учётные записи пользователей. Платежи отключены. Сейчас приложение не сохраняет историю введённых адресов в собственной пользовательской базе. Технические журналы хостинга и внешних сервисов регулируются правилами соответствующих поставщиков."] },
      { title: "Ограничения результата", paragraphs: ["Отчёт оценивает окружение адреса, а не техническое или юридическое состояние недвижимости. Это не официальный документ и не гарантия безопасности, доступности услуг или отсутствия риска. Открытые данные могут быть неполными или устаревшими; периоды источников указаны в методологии."] },
    ],
  },
};

export function getPrivacyContent(locale: string): PrivacyContent {
  return CONTENT[locale === "ru" ? "ru" : locale === "en" ? "en" : "cs"];
}
