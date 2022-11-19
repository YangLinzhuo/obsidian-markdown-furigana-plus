import { Plugin, MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian'

/*
 * Markdown Furigana Plus
*/
const kanaRegex = /[\u3040-\u3096\u30a1-\u30fa\uff66-\uff9fー]/;
const kanjiRegex = /[\u3400-\u9faf]/;

/**
 * Furigana is marked using the {body^furigana} syntax.
 * First step, performed by bodyToRegex, is to convert
 * the body to a regex, which can then be used to pattern
 * match on the furigana.
 *
 * In essence, every kanji needs to be converted to a
 * pattern similar to ".?", so that it can match some kana
 * from the furigana part. However, this alone is ambiguous.
 * Consider {可愛い犬^かわいいいぬ}: in this case there are
 * three different ways to assign furigana in the body.
 *
 * Ambiguities can be resolved by adding separator characters
 * in the furigana. These are only matched at the
 * boundaries between kanji and other kanji/kana.
 * So a regex created from 可愛い犬 should be able to match
 * か・わい・い・いぬ, but a regex created from 美味しい shouldn't
 * be able to match おいし・い.
 *
 * For purposes of this function, only ASCII dot is a
 * separators. Other characters are converted to dots in
 * the {@link cleanFurigana} function.
 *
 * The notation {可愛い犬^か・わい・い・いぬ} forces us to
 * have separate \<rt\> tags for 可 and 愛. If we want to
 * indicate that か corresponds to 可 and わい corresponds to 愛
 * while keeping them under a single \<rt\> tag, we can use
 * a combinator instead of a separator, e.g.:
 * {可愛い犬^か+わい・い・いぬ}
 *
 * For purposes of this function, only ASCII plus is a
 * combinator. Other characters are converted to pluses in
 * the {@link cleanFurigana} function.
 *
 * @param {string} body The non-furigana part.
 * @returns {(null|RegExp)} Null if the body contains no hiragana
 *     or kanji, otherwise a regex to be used on the furigana.
 */
function bodyToRegex(body:string) {
  let regexStr = "^";
  let lastType = "other";

  const combinatorOrSeparatorGroup = "([+.]?)";
  const combinatorOrSeparator = "[+.]?";
  const combinatorOnly = "\\.?";
  const furiganaGroup = "([^+.]+)";

  for (let i = 0; i < body.length; i++) {
    const c = body.charAt(i);
    if (kanjiRegex.test(c)) {
      if (lastType === "kanji") {
        regexStr += combinatorOrSeparatorGroup;
      } else if (lastType === "kana") {
        regexStr += combinatorOrSeparator;
      }

      regexStr += furiganaGroup;
      lastType = "kanji";
    } else if (kanaRegex.test(c)) {
      if (lastType == "kanji") {
        regexStr += combinatorOrSeparator;
      }
      regexStr += c;
      lastType = "kana";
    } else {
      if (lastType !== "other") {
        regexStr += combinatorOnly;
      }
      lastType = "other";
    }
  }

  if (regexStr === "") {
    return null;
  }
  return new RegExp(regexStr + "$");
}


/**
 * For a ruby tag specified as {body^toptext}, tries to find
 * the appropriate furigana in the toptext for every kanji
 * in the body.
 *
 * The result is a flat array where each part of the body
 * is followed by its corresponding furigana. Or, if no
 * such correspondence can be found, just [body, toptext]
 * is returned.
 *
 * As a special case, if toptext starts with = or ＝, the
 * pattern-matching functionality is disabled, and only
 * [body, toptext-without-the-equals-sign] is returned.
 *
 * @example
 * r = matchFurigana('美味しいご飯', 'おいしいごはん')
 * assert(r == ['美味', 'おい', 'しいご', '', '飯', 'はん'])
 *
 * @example
 * // no match
 * r = matchFurigana('食べる', 'たべべ')
 * assert(r == ['食べる', 'たべべ'])
 *
 * @example
 * // disabled pattern matching
 * r = matchFurigana('食べる', '＝たべる')
 * assert(r == ['食べる', 'たべる'])
 *
 * @param {string} body
 * @param {string} toptext
 * @returns {string[]} Flat array of parts of the body followed
 *     by their corresponding furigana, or just [body, toptext]
 *     if no such correspondence exists.
 */
 function matchFurigana(body:string, toptext:string, options: FuriganaOptions) {
  if (/^[=＝]/.test(toptext)) {
    return [[body, toptext.slice(1)]];
  }

  const bodyRegex = bodyToRegex(body);
  if (bodyRegex === null) {
    return [[body, toptext]];
  }

  const match = bodyRegex.exec(cleanFurigana(toptext, options));
  if (match === null) {
    return [[body, toptext]];
  }

  let result = [];
  let curBodyPart = "";
  let curToptextPart = "";
  let matchIndex = 1;
  let lastType = "other";
  for (let i = 0; i < body.length; i++) {
    const c = body.charAt(i);

    if (kanjiRegex.test(c)) {
      if (lastType === "kana" || lastType === "other") {
        if (curBodyPart !== "") {
          result.push([curBodyPart, curToptextPart]);
        }
        curBodyPart = c;
        curToptextPart = match[matchIndex++];
        lastType = "kanji";
        continue;
      }

      const connection = match[matchIndex++];
      if (connection === "+" || connection === "") {
        curBodyPart += c;
        curToptextPart += match[matchIndex++];
      } else {
        result.push([curBodyPart, curToptextPart]);
        curBodyPart = c;
        curToptextPart = match[matchIndex++];
      }
    } else {
      if (lastType !== "kanji") {
        curBodyPart += c;
        continue;
      }

      result.push([curBodyPart, curToptextPart]);
      curBodyPart = c;
      curToptextPart = "";

      if (kanaRegex.test(c)) {
        lastType = "kana";
      } else {
        lastType = "other";
      }
    }
  }

  result.push([curBodyPart, curToptextPart]);
  return result;
}


/**
 * "Cleans" the furigana by converting all allowed
 * separators to ASCII dots and all allowed combinators
 * to ASCII pluses.
 *
 * The meaning of "separator" and "combinator" is
 * described in the {@link bodyToRegex} function.
 *
 * @param {string} furigana
 * @returns {string} Clean version of the furigana.
 */
 function cleanFurigana(furigana:string, options: FuriganaOptions) {
  furigana = furigana.replace(options.separatorRegex, ".");
  furigana = furigana.replace(options.combinatorRegex, "+");
  return furigana;
}

/**
 * Parallel to the {@link matchFurigana} function,
 * but instead of doing any matching it just adds
 * toptext to every character of the body. This
 * is intended to be used for emphasis dots, like
 * you sometimes see in manga.
 *
 * For this, toptext is expected to start with
 * an asterisk (ASCII or full-width), and the actual
 * marker that should be placed after every character
 * should follow afterward.
 *
 * If no marker is provided, a circle (●) is used.
 *
 * Since this is meant to mimic the return value of the
 * {@link matchFurigana} function, the result is just an array
 * of characters from the body followed by the marker.
 *
 * @example
 * r = rubifyEveryCharacter('だから', '*')
 * assert(r == ['だ', '●', 'か', '●', 'ら', '●'])
 *
 * @example
 * r = rubifyEveryCharacter('だから', '*+')
 * assert(r == ['だ', '+', 'か', '+', 'ら', '+'])
 *
 * @param {string} body
 * @param {string} toptext
 * @returns {string[]} Flat array of characters of the body,
 *     each one followed by the marker as specified in toptext.
 */
 function rubifyEveryCharacter(body:string, toptext:string) {
  let topmark = toptext.slice(1);
  if (topmark === "") {
    topmark = "●";
  }

  let result = [];
  for (let c of body) {
    result.push([c, topmark]);
  }
  return result;
}

class FuriganaOptions {
  fallbackParens: string;
  extraSeparators: string;
  extraCombinators: string;
  separatorRegex: RegExp;
  combinatorRegex: RegExp;

  constructor() {
    this.fallbackParens = "【】";
    this.extraSeparators = ("").replace(
      /([\-\]\\])/g,
      "\\$1"
    );
    this.extraCombinators = (this.extraCombinators || "").replace(
      /([\-\]\\])/g,
      "\\$1"
    );

    this.separatorRegex = new RegExp(
      `[\\s.．。・|｜/／${this.extraSeparators}]`,
      "g"
    );
    this.combinatorRegex = new RegExp(`[+＋${this.extraCombinators}]`, "g");
  }
}

/**
 * Returns a function that's compatible for use with
 * markdown-it's inline ruler. The function is further
 * customizable via the options.
 *
 * Available options:
 * - fallbackParens: fallback parentheses for the resulting
 *     \<ruby\> tags. Default value: "【】".
 * - extraSeparators: additional characters that can be used
 *     to separate furigana. Empty by default. Example value:
 *     "_-*".
 *
 *     The characters that are already hard-coded as
 *     separator characters are any kind of space, as well as
 *     these: ".．。・|｜/／".
 * - extraCombinators: additional characters that can be used
 *     to indicate a kanji boundary without actually splitting
 *     the furigana. Empty by default.
 *
 *     The characters that are already hard-coded as
 *     combinator characters are '+' and '＋'.
 *
 * @param {Object} options
 */
 function furigana(body:string, toptext:string, options: FuriganaOptions = new FuriganaOptions()) {
  const emphasisDotsIndicatorRegex = /^[*＊].?/;
  if (emphasisDotsIndicatorRegex.test(toptext)) {
    return rubifyEveryCharacter(body, toptext);
    // rubyHelper.addTag(state, content);
  } else {
    return matchFurigana(body, toptext, options);
    // rubyHelper.addTag(state, content, options.fallbackParens);
  }
}

// ======== The following is old code ========

// Regular Expression for {{kanji|kana|kana|...}} format
// const REGEXP = /{((?:[\u4E00-\u9FFFㄅ-ㄩぁ-んァ-ンー〇])+)((?:\|[^ -\/{-~:-@\[-`]*)+)}/gm
const REGEXP = /{(.+)\^(.+)}/gm

// Main Tags to search for Furigana Syntax
const TAGS = 'p, h1, h2, h3, h4, h5, h6, ol, ul, table'

const convertFuriganaPlus = (element:Text): Node => {
  const matches = Array.from(element.textContent.matchAll(REGEXP))
  let lastNode = element
  for (const match of matches) {
    // match[1] is body
    // match[2] is toptext
    const content = furigana(match[1], match[2])
    console.table(content)
    // content is an array of array
    // [[text, topmark], [text, topmark]]
    const rubyNode = document.createElement('ruby')
    content.forEach(pair => {
      // rubyNode.addClass('furi')
      const body = pair[0]
      const mark = pair[1]
      rubyNode.appendText(body)
      rubyNode.createEl('rt', { text: mark })
    })
    const nodeToReplace = lastNode.splitText(lastNode.textContent.indexOf(match[0]))
    lastNode = nodeToReplace.splitText(match[0].length)
    nodeToReplace.replaceWith(rubyNode)
  }
  return element
}


const convertFurigana = (element:Text): Node => {
  const matches = Array.from(element.textContent.matchAll(REGEXP))
  let lastNode = element
  for (const match of matches) {
    const furi = match[2].split('|').slice(1) // First Element will be empty
    const kanji = furi.length === 1 ? [match[1]] : match[1].split('')
    if (kanji.length === furi.length) {
      // Number of Characters in first section must be equal to number of furigana sections (unless only one furigana section)
      const rubyNode = document.createElement('ruby')
      rubyNode.addClass('furi')
      kanji.forEach((k, i) => {
        rubyNode.appendText(k)
        rubyNode.createEl('rt', { text: furi[i] })
      })
      const nodeToReplace = lastNode.splitText(lastNode.textContent.indexOf(match[0]))
      lastNode = nodeToReplace.splitText(match[0].length)
      nodeToReplace.replaceWith(rubyNode)
    }
  }
  return element
}

export default class MarkdownFurigana extends Plugin {
    public postprocessor: MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const blockToReplace = el.querySelectorAll(TAGS)
      if (blockToReplace.length === 0) return

      function replace (node:Node) {
        const childrenToReplace: Text[] = []
        node.childNodes.forEach(child => {
          if (child.nodeType === 3) {
            // Nodes of Type 3 are TextElements
            childrenToReplace.push(child as Text)
          } else if (child.hasChildNodes() && child.nodeName !== 'CODE' && child.nodeName !== 'RUBY') {
            // Ignore content in Code Blocks
            replace(child)
          }
        })
        childrenToReplace.forEach((child) => {
          // child.replaceWith(convertFurigana(child))
          child.replaceWith(convertFuriganaPlus(child))
        })
      }
      
      blockToReplace.forEach(block => {
        replace(block)
      })
    }

    async onload () {
      console.log('loading Markdown Furigana plugin')
      this.registerMarkdownPostProcessor(this.postprocessor)
    }

    onunload () {
      console.log('unloading Markdown Furigana plugin')
    }
}
