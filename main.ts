import { Plugin, MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian'
import { convertFuriganaPlus } from './furigana'

const TAGS = 'p, h1, h2, h3, h4, h5, h6, ol, ul, table'

export default class MarkdownFurigana extends Plugin {
    public postprocessor: MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const blockToReplace = el.querySelectorAll(TAGS)
      if (blockToReplace.length === 0) return

      function replaceFurigana (node:Node) {
        const childrenToReplace: Text[] = []
        node.childNodes.forEach(child => {
          if (child.nodeType === 3) {
            // Nodes of Type 3 are TextElements
            childrenToReplace.push(child as Text)
          } else if (child.hasChildNodes() && child.nodeName !== 'CODE' && child.nodeName !== 'RUBY') {
            // Ignore content in Code Blocks
            replaceFurigana(child)
          }
        })
        childrenToReplace.forEach((child) => {
          // child.replaceWith(convertFurigana(child))
          child.replaceWith(convertFuriganaPlus(child))
        })
      }

      blockToReplace.forEach(block => {
        replaceFurigana(block)
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
