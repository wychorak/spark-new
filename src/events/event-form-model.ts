import { parseEventDateTimeInput } from "../events";

export const dateText = (value: Date) => `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;

export function validateEventFields(name: string, city: string, start: string, end: string, now = Date.now(), allowStarted = false) {
  const errors: string[] = [];
  if (name.trim().length < 3 || name.trim().length > 80) errors.push("Nazwa musi mieć od 3 do 80 znaków.");
  if (city.trim().length < 2 || city.trim().length > 80) errors.push("Wybierz miasto lub wpisz miejscowość (2–80 znaków).");
  const startsAt = parseEventDateTimeInput(start), endsAt = parseEventDateTimeInput(end);
  if (!startsAt || !endsAt) errors.push("Wybierz prawidłowy dzień i godzinę początku oraz końca.");
  else {
    if (!allowStarted && Date.parse(startsAt) <= now) errors.push("Początek wydarzenia musi przypadać w przyszłości.");
    if (Date.parse(endsAt) <= now) errors.push("Koniec wydarzenia musi przypadać w przyszłości.");
    if (Date.parse(endsAt) <= Date.parse(startsAt)) errors.push("Koniec musi być późniejszy niż początek wydarzenia.");
    if (Date.parse(startsAt) > now + 400 * 86400000 || Date.parse(endsAt) > now + 400 * 86400000) errors.push("Wybierz termin w ciągu najbliższych 400 dni.");
  }
  return { errors, startsAt, endsAt };
}
/** Reject calendar rollover, invalid years and skipped DST hours. */
export function parseEventDate(date: string, time: string): number | null {
  const d = date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const t = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) return null;
  const [day, month, year, hour, minute] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (year < 2000 || year > 2200 || hour > 23 || minute > 59) return null;
  const value = new Date(year, month - 1, day, hour, minute);
  if (value.getFullYear() !== year || value.getDate() !== day || value.getMonth() !== month - 1 || value.getHours() !== hour || value.getMinutes() !== minute) return null;
  return value.getTime();
}

// Offline suggestions. Other localities remain valid: no location permission,
// API key or paid geocoding is required just to create an event.
export const POLISH_CITIES = ["Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Białystok", "Katowice", "Gdynia", "Częstochowa", "Radom", "Rzeszów", "Toruń", "Sosnowiec", "Kielce", "Gliwice", "Olsztyn", "Zabrze", "Bielsko-Biała", "Bytom", "Zielona Góra", "Rybnik", "Ruda Śląska", "Opole", "Tychy", "Gorzów Wielkopolski", "Elbląg", "Dąbrowa Górnicza", "Płock", "Wałbrzych", "Włocławek", "Tarnów", "Chorzów", "Koszalin", "Kalisz", "Legnica", "Grudziądz", "Jaworzno", "Słupsk", "Jastrzębie-Zdrój", "Nowy Sącz", "Jelenia Góra", "Siedlce", "Mysłowice", "Konin", "Piotrków Trybunalski", "Piła", "Inowrocław", "Lubin", "Ostrów Wielkopolski", "Suwałki", "Stargard", "Gniezno", "Głogów", "Siemianowice Śląskie", "Pabianice", "Leszno", "Zamość", "Łomża", "Chełm", "Tomaszów Mazowiecki", "Ełk", "Pruszków", "Stalowa Wola", "Mielec", "Tarnowskie Góry", "Kędzierzyn-Koźle", "Tczew", "Biała Podlaska", "Bełchatów", "Świdnica", "Będzin", "Zgierz", "Piekary Śląskie", "Racibórz", "Legionowo", "Ostrołęka", "Wejherowo", "Rumia", "Zawiercie", "Świętochłowice", "Starachowice", "Wodzisław Śląski", "Skierniewice", "Puławy", "Starogard Gdański", "Kołobrzeg", "Krosno", "Dębica", "Nysa", "Zakopane", "Sopot", "Oświęcim", "Cieszyn", "Żywiec", "Nowy Targ", "Malbork", "Sandomierz", "Giżycko", "Mrągowo", "Augustów", "Ustka", "Świnoujście", "Karpacz", "Szklarska Poręba", "Wieliczka", "Bochnia", "Otwock", "Piaseczno", "Marki", "Ząbki", "Wołomin", "Grodzisk Mazowiecki", "Żyrardów", "Sochaczew", "Pszczyna", "Żory", "Knurów", "Olkusz", "Chrzanów", "Wadowice", "Śrem", "Września", "Kościan", "Swarzędz", "Luboń", "Police", "Szczecinek", "Chojnice", "Brodnica", "Iława", "Ostróda", "Kwidzyn", "Kościerzyna", "Kartuzy", "Sanok", "Jasło", "Jarosław", "Przemyśl", "Łańcut", "Łuków", "Kraśnik", "Działdowo", "Wyszków", "Ciechanów", "Mława", "Płońsk", "Zduńska Wola", "Sieradz", "Kutno", "Łowicz", "Łęczyca", "Radomsko", "Skarżysko-Kamienna", "Ostrowiec Świętokrzyski", "Busko-Zdrój", "Kłodzko", "Bolesławiec", "Dzierżoniów", "Świebodzice", "Żary", "Żagań", "Nowa Sól", "Świebodzin"];
export const searchKey = (text: string) => text.toLocaleLowerCase("pl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").trim();
export function matchingCities(query: string, limit = 12) {
  const key = searchKey(query);
  if (!key) return POLISH_CITIES.slice(0, limit);
  return POLISH_CITIES.filter((city) => searchKey(city).includes(key)).sort((a, b) => Number(searchKey(b).startsWith(key)) - Number(searchKey(a).startsWith(key)) || a.localeCompare(b, "pl")).slice(0, limit);
}
