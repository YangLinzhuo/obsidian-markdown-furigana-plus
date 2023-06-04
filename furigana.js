"use strict";
/*
 * Markdown Furigana Plus
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertFuriganaPlus = void 0;
var kanaRegex = /[\u3040-\u3096\u30a1-\u30fa\uff66-\uff9fー]/;
var kanjiRegex = /[\u3400-\u9faf]/;
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
function bodyToRegex(body) {
    var regexStr = '^';
    var lastType = 'other';
    var combinatorOrSeparatorGroup = '([+.]?)';
    var combinatorOrSeparator = '[+.]?';
    var combinatorOnly = '\\.?';
    var furiganaGroup = '([^+.]+)';
    for (var i = 0; i < body.length; i++) {
        var c = body.charAt(i);
        if (kanjiRegex.test(c)) {
            if (lastType === 'kanji') {
                regexStr += combinatorOrSeparatorGroup;
            }
            else if (lastType === 'kana') {
                regexStr += combinatorOrSeparator;
            }
            regexStr += furiganaGroup;
            lastType = 'kanji';
        }
        else if (kanaRegex.test(c)) {
            if (lastType === 'kanji') {
                regexStr += combinatorOrSeparator;
            }
            regexStr += c;
            lastType = 'kana';
        }
        else {
            if (lastType !== 'other') {
                regexStr += combinatorOnly;
            }
            lastType = 'other';
        }
    }
    if (regexStr === '') {
        return null;
    }
    return new RegExp(regexStr + '$');
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
function matchFurigana(body, toptext, options) {
    if (/^[=＝]/.test(toptext)) {
        return [[body, toptext.slice(1)]];
    }
    var bodyRegex = bodyToRegex(body);
    if (bodyRegex === null) {
        return [[body, toptext]];
    }
    var match = bodyRegex.exec(cleanFurigana(toptext, options));
    if (match === null) {
        return [[body, toptext]];
    }
    var result = [];
    var curBodyPart = '';
    var curToptextPart = '';
    var matchIndex = 1;
    var lastType = 'other';
    for (var i = 0; i < body.length; i++) {
        var c = body.charAt(i);
        if (kanjiRegex.test(c)) {
            if (lastType === 'kana' || lastType === 'other') {
                if (curBodyPart !== '') {
                    result.push([curBodyPart, curToptextPart]);
                }
                curBodyPart = c;
                curToptextPart = match[matchIndex++];
                lastType = 'kanji';
                continue;
            }
            var connection = match[matchIndex++];
            if (connection === '+' || connection === '') {
                curBodyPart += c;
                curToptextPart += match[matchIndex++];
            }
            else {
                result.push([curBodyPart, curToptextPart]);
                curBodyPart = c;
                curToptextPart = match[matchIndex++];
            }
        }
        else {
            if (lastType !== 'kanji') {
                curBodyPart += c;
                continue;
            }
            result.push([curBodyPart, curToptextPart]);
            curBodyPart = c;
            curToptextPart = '';
            if (kanaRegex.test(c)) {
                lastType = 'kana';
            }
            else {
                lastType = 'other';
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
function cleanFurigana(furigana, options) {
    furigana = furigana.replace(options.separatorRegex, '.');
    furigana = furigana.replace(options.combinatorRegex, '+');
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
function rubifyEveryCharacter(body, toptext) {
    var topmark = toptext.slice(1);
    if (topmark === '') {
        topmark = '●';
    }
    var result = [];
    for (var _i = 0, body_1 = body; _i < body_1.length; _i++) {
        var c = body_1[_i];
        result.push([c, topmark]);
    }
    return result;
}
var FuriganaOptions = /** @class */ (function () {
    function FuriganaOptions() {
        this.fallbackParens = '【】';
        this.extraSeparators = ('').replace(/([\-\]\\])/g, '\\$1');
        this.extraCombinators = (this.extraCombinators || '').replace(/([\-\]\\])/g, '\\$1');
        this.separatorRegex = new RegExp("[\\s.\uFF0E\u3002\u30FB|\uFF5C/\uFF0F".concat(this.extraSeparators, "]"), 'g');
        this.combinatorRegex = new RegExp("[+\uFF0B".concat(this.extraCombinators, "]"), 'g');
    }
    return FuriganaOptions;
}());
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
function furigana(body, toptext, options) {
    if (options === void 0) { options = new FuriganaOptions(); }
    var emphasisDotsIndicatorRegex = /^[*＊].?/;
    if (emphasisDotsIndicatorRegex.test(toptext)) {
        return rubifyEveryCharacter(body, toptext);
        // rubyHelper.addTag(state, content);
    }
    else {
        return matchFurigana(body, toptext, options);
        // rubyHelper.addTag(state, content, options.fallbackParens);
    }
}
// Regular Expression for {{kanji|kana|kana|...}} format
// const REGEXP = /{((?:[\u4E00-\u9FFFㄅ-ㄩぁ-んァ-ンー〇])+)((?:\|[^ -\/{-~:-@\[-`]*)+)}/gm
var REGEXP = /{(.+?)\^(.+?)}/gm;
var convertFuriganaPlus = function (element) {
    var matches = Array.from(element.textContent.matchAll(REGEXP));
    var lastNode = element;
    var _loop_1 = function (match) {
        // match[1] is body
        // match[2] is toptext
        var content = furigana(match[1], match[2]);
        // content is an array of array
        // [[text, topmark], [text, topmark]]
        var rubyNode = document.createElement('ruby');
        content.forEach(function (pair) {
            // rubyNode.addClass('furi')
            var body = pair[0];
            var mark = pair[1];
            rubyNode.appendText(body);
            rubyNode.createEl('rt', { text: mark });
        });
        var nodeToReplace = lastNode.splitText(lastNode.textContent.indexOf(match[0]));
        lastNode = nodeToReplace.splitText(match[0].length);
        nodeToReplace.replaceWith(rubyNode);
    };
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var match = matches_1[_i];
        _loop_1(match);
    }
    return element;
};
exports.convertFuriganaPlus = convertFuriganaPlus;
