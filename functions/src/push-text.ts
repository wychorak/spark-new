// Push notification texts per app language. Devices store the language the app
// runs in; older registrations without it are Polish installs.
export const pushLanguages = ["pl", "en", "de", "uk", "es"] as const;
export type PushLanguage = typeof pushLanguages[number];

export function pushLanguage(value: unknown): PushLanguage {
  return pushLanguages.includes(value as PushLanguage) ? value as PushLanguage : "pl";
}

type Vars = { name?: string; event?: string; text?: string };
type Template = (vars: Vars) => { title: string; body: string };

const someone: Record<PushLanguage, string> = { pl: "Ktoś", en: "Someone", de: "Jemand", uk: "Хтось", es: "Alguien" };
const who = (language: PushLanguage, vars: Vars) => vars.name?.trim() || someone[language];

const templates: Record<string, Record<PushLanguage, Template>> = {
  moderationWarning: {
    pl: () => ({ title: "Wiadomość od zespołu Spark", body: "Otrzymaliśmy zgłoszenie dotyczące Twojego konta. Sprawdź zasady społeczności." }),
    en: () => ({ title: "A message from the Spark team", body: "We received a report about your account. Please review our community guidelines." }),
    de: () => ({ title: "Nachricht vom Spark-Team", body: "Wir haben eine Meldung zu deinem Konto erhalten. Bitte lies unsere Community-Richtlinien." }),
    uk: () => ({ title: "Повідомлення від команди Spark", body: "Ми отримали скаргу щодо твого акаунта. Ознайомся з правилами спільноти." }),
    es: () => ({ title: "Mensaje del equipo de Spark", body: "Hemos recibido una denuncia sobre tu cuenta. Revisa las normas de la comunidad." })
  },
  chatRequest: {
    pl: (v) => ({ title: "Nowa prośba o rozmowę", body: who("pl", v) + " chce rozpocząć rozmowę." }),
    en: (v) => ({ title: "New chat request", body: who("en", v) + " wants to start a conversation." }),
    de: (v) => ({ title: "Neue Chat-Anfrage", body: who("de", v) + " möchte ein Gespräch beginnen." }),
    uk: (v) => ({ title: "Новий запит на розмову", body: who("uk", v) + " хоче почати розмову." }),
    es: (v) => ({ title: "Nueva solicitud de chat", body: who("es", v) + " quiere empezar a hablar contigo." })
  },
  newMatch: {
    pl: (v) => ({ title: "Nowy match w Spark", body: "Ty i " + who("pl", v) + " polubiliście się nawzajem." }),
    en: (v) => ({ title: "New match on Spark", body: "You and " + who("en", v) + " liked each other." }),
    de: (v) => ({ title: "Neues Match bei Spark", body: "Du und " + who("de", v) + " habt euch gegenseitig geliked." }),
    uk: (v) => ({ title: "Новий метч у Spark", body: "Ти і " + who("uk", v) + " вподобали одне одного." }),
    es: (v) => ({ title: "Nuevo match en Spark", body: "A ti y a " + who("es", v) + " os habéis gustado mutuamente." })
  },
  requestAccepted: {
    pl: (v) => ({ title: "Prośba zaakceptowana", body: who("pl", v) + " zaakceptował(a) Twoją prośbę. Możecie już pisać." }),
    en: (v) => ({ title: "Request accepted", body: who("en", v) + " accepted your request. You can chat now." }),
    de: (v) => ({ title: "Anfrage angenommen", body: who("de", v) + " hat deine Anfrage angenommen. Ihr könnt jetzt schreiben." }),
    uk: (v) => ({ title: "Запит прийнято", body: who("uk", v) + " прийняв(-ла) твій запит. Тепер можете писати." }),
    es: (v) => ({ title: "Solicitud aceptada", body: who("es", v) + " aceptó tu solicitud. Ya podéis chatear." })
  },
  newMessage: {
    pl: (v) => ({ title: who("pl", v), body: v.text || "Nowa wiadomość" }),
    en: (v) => ({ title: who("en", v), body: v.text || "New message" }),
    de: (v) => ({ title: who("de", v), body: v.text || "Neue Nachricht" }),
    uk: (v) => ({ title: who("uk", v), body: v.text || "Нове повідомлення" }),
    es: (v) => ({ title: who("es", v), body: v.text || "Nuevo mensaje" })
  },
  newEvent: {
    pl: (v) => ({ title: "Nowe wydarzenie w aplikacji Spark!", body: "Teraz możecie razem iść na popularne eventy. Kliknij, aby zobaczyć: " + v.event + "." }),
    en: (v) => ({ title: "New event on Spark!", body: "Find people to go with. Tap to see: " + v.event + "." }),
    de: (v) => ({ title: "Neues Event bei Spark!", body: "Finde Leute, mit denen du hingehst. Tippe, um es zu sehen: " + v.event + "." }),
    uk: (v) => ({ title: "Нова подія в Spark!", body: "Знайди компанію, щоб піти разом. Торкнися, щоб переглянути: " + v.event + "." }),
    es: (v) => ({ title: "¡Nuevo evento en Spark!", body: "Encuentra gente con quien ir. Toca para verlo: " + v.event + "." })
  },
  proposalApproved: {
    pl: (v) => ({ title: "Wydarzenie zaakceptowane", body: "„" + v.event + "” jest już w Event Friends. Zaznacz, że idziesz, i poznaj ekipę." }),
    en: (v) => ({ title: "Event approved", body: "“" + v.event + "” is now in Event Friends. Mark that you're going and meet the crew." }),
    de: (v) => ({ title: "Event angenommen", body: "„" + v.event + "“ ist jetzt bei Event Friends. Markiere, dass du hingehst, und lerne die Leute kennen." }),
    uk: (v) => ({ title: "Подію схвалено", body: "«" + v.event + "» вже в Event Friends. Познач, що йдеш, і знайомся з компанією." }),
    es: (v) => ({ title: "Evento aprobado", body: "«" + v.event + "» ya está en Event Friends. Marca que vas y conoce al grupo." })
  },
  proposalRejected: {
    pl: (v) => ({ title: "Zgłoszenie wydarzenia", body: "Nie dodaliśmy „" + v.event + "” do Event Friends. Możesz zgłosić je ponownie z poprawionymi danymi." }),
    en: (v) => ({ title: "Event suggestion", body: "We didn't add “" + v.event + "” to Event Friends. You can suggest it again with corrected details." }),
    de: (v) => ({ title: "Event-Vorschlag", body: "Wir haben „" + v.event + "“ nicht zu Event Friends hinzugefügt. Du kannst es mit korrigierten Angaben erneut vorschlagen." }),
    uk: (v) => ({ title: "Пропозиція події", body: "Ми не додали «" + v.event + "» до Event Friends. Можеш запропонувати її знову з виправленими даними." }),
    es: (v) => ({ title: "Propuesta de evento", body: "No hemos añadido «" + v.event + "» a Event Friends. Puedes proponerlo de nuevo con los datos corregidos." })
  }
};

export type PushTextKey = keyof typeof templates;

export function renderPush(key: PushTextKey, language: PushLanguage, vars: Vars = {}) {
  return templates[key][language](vars);
}
