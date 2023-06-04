// Regular Expression for {{kanji|kana|kana|...}} format
// const REGEXP = /{((?:[\u4E00-\u9FFFㄅ-ㄩぁ-んァ-ンー〇])+)((?:\|[^ -\/{-~:-@\[-`]*)+)}/gm
// const REGEXP = /^[+]{3}([a-z]*)\n([^(+++)]*)\n^[+]{3}/gm
const REGEXP = /^:::(info|warning)\n([\s\S]*)\n^:::/gm

export const convertInfo = (element:Text): Node => {
  const matches = Array.from(element.textContent.matchAll(REGEXP))
  let lastNode = element
  for (const match of matches) {
    // match[1] is body
    // match[2] is toptext
    // const content = furigana(match[1], match[2])
    // content is an array of array
    // [[text, topmark], [text, topmark]]
  //   const rubyNode = document.createElement('ruby')
  //   content.forEach(pair => {
  //     // rubyNode.addClass('furi')
  //     const body = pair[0]
  //     const mark = pair[1]
  //     rubyNode.appendText(body)
  //     rubyNode.createEl('rt', { text: mark })
  //   })
  //   const nodeToReplace = lastNode.splitText(lastNode.textContent.indexOf(match[0]))
  //   lastNode = nodeToReplace.splitText(match[0].length)
  //   nodeToReplace.replaceWith(rubyNode)
  }
  return element
}
