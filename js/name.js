const Name = {
  vowels: "аеёиоуыэюяәөүұіaeiouy",

  maleEndingA: [
    "никита", "илья", "данила", "фома", "кузьма", "лука", "савва", "миша", "гриша", "коля", "ваня",
    "дима", "вася", "витя", "петя", "лёша", "леша", "жора", "гоша", "гена", "толя", "юра", "стёпа",
    "степа", "серёжа", "сережа", "паша", "вова", "лёва", "лева", "лёня", "тёма", "тема", "тима",
    "костя", "рома", "андрюша", "егорка", "ванька", "димка", "максимка", "тимоша", "женя", "ильюша"
  ],

  unisex: ["саша", "женя", "валя", "шура", "слава", "ники", "юля"],

  knownMale: [
    "артём", "артем", "максим", "иван", "даниил", "данил", "александр", "дмитрий", "андрей", "сергей",
    "егор", "кирилл", "михаил", "матвей", "роман", "тимур", "руслан", "владимир", "николай", "алексей",
    "игорь", "павел", "денис", "антон", "евгений", "арсений", "глеб", "лев", "марк", "олег", "георгий",
    "пётр", "петр", "степан", "фёдор", "федор", "виктор", "юрий", "станислав", "тимофей", "ярослав",
    "богдан", "захар", "назар", "мирон", "платон", "демид", "савелий", "семён", "семен", "аскар",
    "айдар", "алихан", "нурсултан", "ерлан", "думан", "бекзат", "санжар", "нурлан", "арман", "ернар"
  ],

  stems: [
    "йух", "еух", "яух", "здзип", "набе", "табе", "чубе", "тяб", "яблб", "акус", "кадум", "лидум",
    "нвог", "пулаз", "родип", "радип", "нодна", "хюлш", "чорд", "kcuf", "tihs", "hctib"
  ],

  format(raw) {
    return String(raw)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/(^|[ \-'’])(\p{L})/gu, (match, sep, ch) => sep + ch.toUpperCase());
  },

  rudeStems() {
    return this.stems
      .map(stem => stem.split("").reverse().join(""))
      .filter(stem => stem.length > 3 || ["хуй", "хуе", "хуя"].indexOf(stem) >= 0);
  },

  validate(raw) {
    const text = String(raw).replace(/\s+/g, " ").trim();
    if (!text) return "";
    const flat = text.toLowerCase().replace(/ё/g, "е");
    if (flat === "флори" || flat === "flori") return "flori";
    if (["мэйлия", "мейлия", "mailia", "maylia"].indexOf(flat) >= 0) return "mailia";
    if (/^6\s*7$/.test(text)) return "sixtyseven";
    if (/^0+$/.test(text)) return "zero";
    if (/\d/.test(text)) return "digits";
    if (!/^[\p{L}][\p{L}'’\- ]*$/u.test(text)) return "symbols";
    if (text.split(" ").length > 2) return "words";
    const letters = text.replace(/[^\p{L}]/gu, "");
    if (letters.length < 2) return "short";
    if (/(.)\1{3,}/iu.test(letters)) return "gibberish";
    if (letters.length >= 3 && !new RegExp("[" + this.vowels + "]", "iu").test(letters)) return "gibberish";
    const lettersFlat = letters.toLowerCase().replace(/ё/g, "е");
    if (this.rudeStems().some(stem => lettersFlat.indexOf(stem) >= 0)) return "rude";
    return "";
  },

  guess(name) {
    const first = String(name).trim().toLowerCase().split(/[ \-]/)[0];
    if (!first) return "";
    if (this.unisex.indexOf(first) >= 0) return "";
    if (this.maleEndingA.indexOf(first) >= 0) return "m";
    if (this.knownMale.indexOf(first) >= 0) return "m";
    if (/(ий|ей)$/.test(first)) return "m";
    if (/[ая]$/.test(first)) return "f";
    return "";
  }
};
