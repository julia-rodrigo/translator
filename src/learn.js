export const LEARN = {
  verbs: [
    { key: "食べる", kana: "たべる", en: "to eat", kind: "ru-verb: drop る, add the ending", rows: [
      ["Now / future", "do, will do", "食べる", "taberu", "食べます", "tabemasu"],
      ["Negative", "don't", "食べない", "tabenai", "食べません", "tabemasen"],
      ["Past", "did", "食べた", "tabeta", "食べました", "tabemashita"],
      ["Past negative", "didn't", "食べなかった", "tabenakatta", "食べませんでした", "tabemasen deshita"],
      ["Doing now", "am doing", "食べてる", "tabeteru", "食べています", "tabete imasu"],
      ["Want to", "want to do", "食べたい", "tabetai", "食べたいです", "tabetai desu"],
      ["Let's", "let's do", "食べよう", "tabeyō", "食べましょう", "tabemashō"],
      ["Please", "please do", "食べて", "tabete", "食べてください", "tabete kudasai"] ] },
    { key: "行く", kana: "いく", en: "to go", kind: "u-verb: the last sound changes (く → き, か, こ…)", rows: [
      ["Now / future", "do, will do", "行く", "iku", "行きます", "ikimasu"],
      ["Negative", "don't", "行かない", "ikanai", "行きません", "ikimasen"],
      ["Past", "did", "行った", "itta", "行きました", "ikimashita"],
      ["Past negative", "didn't", "行かなかった", "ikanakatta", "行きませんでした", "ikimasen deshita"],
      ["Doing now", "am doing", "行ってる", "itteru", "行っています", "itte imasu"],
      ["Want to", "want to do", "行きたい", "ikitai", "行きたいです", "ikitai desu"],
      ["Let's", "let's do", "行こう", "ikō", "行きましょう", "ikimashō"],
      ["Please", "please do", "行って", "itte", "行ってください", "itte kudasai"] ] },
    { key: "する", kana: "する", en: "to do", kind: "irregular: just memorise it", rows: [
      ["Now / future", "do, will do", "する", "suru", "します", "shimasu"],
      ["Negative", "don't", "しない", "shinai", "しません", "shimasen"],
      ["Past", "did", "した", "shita", "しました", "shimashita"],
      ["Past negative", "didn't", "しなかった", "shinakatta", "しませんでした", "shimasen deshita"],
      ["Doing now", "am doing", "してる", "shiteru", "しています", "shite imasu"],
      ["Want to", "want to do", "したい", "shitai", "したいです", "shitai desu"],
      ["Let's", "let's do", "しよう", "shiyō", "しましょう", "shimashō"],
      ["Please", "please do", "して", "shite", "してください", "shite kudasai"] ] },
    { key: "来る", kana: "くる", en: "to come", kind: "irregular: the reading changes (く, こ, き)", rows: [
      ["Now / future", "do, will do", "来る", "kuru", "来ます", "kimasu"],
      ["Negative", "don't", "来ない", "konai", "来ません", "kimasen"],
      ["Past", "did", "来た", "kita", "来ました", "kimashita"],
      ["Past negative", "didn't", "来なかった", "konakatta", "来ませんでした", "kimasen deshita"],
      ["Doing now", "am doing", "来てる", "kiteru", "来ています", "kite imasu"],
      ["Want to", "want to do", "来たい", "kitai", "来たいです", "kitai desu"],
      ["Let's", "let's do", "来よう", "koyō", "来ましょう", "kimashō"],
      ["Please", "please do", "来て", "kite", "来てください", "kite kudasai"] ] }
  ],
  describing: [
    { title: "い-adjectives", sub: "高い (takai) · expensive", rows: [
      ["Is", "", "高い", "takai", "高いです", "takai desu"],
      ["Isn't", "", "高くない", "takakunai", "高くないです", "takakunai desu"],
      ["Was", "", "高かった", "takakatta", "高かったです", "takakatta desu"],
      ["Wasn't", "", "高くなかった", "takakunakatta", "高くなかったです", "takakunakatta desu"] ] },
    { title: "Nouns and な-adjectives", sub: "学生 (gakusei) · student", rows: [
      ["Is", "", "学生だ", "gakusei da", "学生です", "gakusei desu"],
      ["Isn't", "", "学生じゃない", "gakusei ja nai", "学生じゃないです", "gakusei ja nai desu"],
      ["Was", "", "学生だった", "gakusei datta", "学生でした", "gakusei deshita"],
      ["Wasn't", "", "学生じゃなかった", "gakusei ja nakatta", "学生じゃなかったです", "gakusei ja nakatta desu"] ] }
  ],
  // [meaning, [standard, romaji], [Osaka, romaji], [Kyoto, romaji]]
  dialects: [
    ["is (casual)", ["だ", "da"], ["や", "ya"], ["や", "ya"]],
    ["isn't / no way", ["違う", "chigau"], ["ちゃう", "chau"], ["ちゃう", "chau"]],
    ["don't go", ["行かない", "ikanai"], ["行かへん / 行かん", "ikahen / ikan"], ["行かへん", "ikahen"]],
    ["really", ["本当", "hontō"], ["ほんま", "honma"], ["ほんま", "honma"]],
    ["very", ["とても", "totemo"], ["めっちゃ", "meccha"], ["えらい / ようけ", "erai / yōke"]],
    ["no good / don't", ["だめ", "dame"], ["あかん", "akan"], ["あかん", "akan"]],
    ["that's right", ["そうだね", "sō da ne"], ["せやな", "seya na"], ["そやね", "soya ne"]],
    ["so / because", ["だから", "dakara"], ["せやから", "seyakara"], ["そやし", "soyashi"]],
    ["how much?", ["いくら？", "ikura?"], ["なんぼ？", "nanbo?"], ["なんぼ？", "nanbo?"]],
    ["thank you", ["ありがとう", "arigatō"], ["おおきに", "ōkini"], ["おおきに", "ōkini"]],
    ["(someone) goes, respectful", ["行かれる", "ikareru"], ["行かはる", "ikaharu"], ["行かはる", "ikaharu"]],
    ["please eat (gentle)", ["食べて", "tabete"], ["食べや", "tabe ya"], ["食べよし", "tabe yoshi"]],
    ["it is (polite, old-style)", ["です", "desu"], ["だす", "dasu"], ["どす", "dosu"]]
  ]
};
