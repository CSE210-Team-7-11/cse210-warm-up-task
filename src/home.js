import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import { createChart } from './graph/Graph.js'

const editor = document.querySelector('#code-editor')
const highlight = document.querySelector('#code-highlight')
const error = document.querySelector('#code-error')
const chart = createChart(document.querySelector('#code-chart'))
let timer

function run() {
  try {
    new Function('chart', '"use strict";\n' + editor.value)(chart)
    error.textContent = ''
  } catch (problem) {
    error.textContent = problem?.message ?? String(problem)
  }
}

editor.addEventListener('scroll', () => {
  highlight.parentElement.scrollTop = editor.scrollTop
  highlight.parentElement.scrollLeft = editor.scrollLeft
})
editor.addEventListener('input', () => {
  highlight.innerHTML = Prism.highlight(editor.value + '\n', Prism.languages.javascript, 'javascript')
  clearTimeout(timer)
  timer = setTimeout(run, 200)
})
highlight.innerHTML = Prism.highlight(editor.value + '\n', Prism.languages.javascript, 'javascript')
run()
