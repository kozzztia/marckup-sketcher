import './style.css'
import { isValidHTMLNesting } from 'validate-html-nesting'

declare global {
  interface Window {
    markupSketcherWindow?: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
    }
  }
}

type BlockNode = {
  id: string
  tag: string
  className: string
  shadowColor: string
  locked: boolean
  flex: boolean
  flexDirection: 'row' | 'column'
  justifyContent: 'start' | 'center' | 'between' | 'end'
  alignItems: 'start' | 'center' | 'stretch' | 'end'
  gap: number
  flexSnapshot: Record<string, { x: number; y: number; width: number; height: number }>
  x: number
  y: number
  width: number
  height: number
  children: BlockNode[]
}

type FlatBlock = BlockNode & {
  depth: number
  parentId: string | null
}

type TagGroup = 'block' | 'inline'

const root: BlockNode = {
  id: 'inner',
  tag: 'div',
  className: 'inner',
  shadowColor: '',
  locked: false,
  flex: false,
  flexDirection: 'row',
  justifyContent: 'start',
  alignItems: 'stretch',
  gap: 12,
  flexSnapshot: {},
  x: 24,
  y: 24,
  width: 1420,
  height: 620,
  children: [],
}

const blockTags = [
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'canvas',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'menu',
  'nav',
  'noscript',
  'ol',
  'p',
  'pre',
  'search',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]
const inlineTags = [
  'a',
  'abbr',
  'area',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'br',
  'button',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'embed',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'link',
  'map',
  'mark',
  'math',
  'meta',
  'meter',
  'object',
  'output',
  'picture',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'sup',
  'svg',
  'template',
  'textarea',
  'time',
  'track',
  'u',
  'var',
  'video',
  'wbr',
]
const allTags = [...blockTags, ...inlineTags].sort()
const popularBlockTags = [
  'article',
  'aside',
  'div',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]
const popularInlineTags = ['a', 'br', 'button', 'em', 'i', 'img', 'input', 'label', 'option', 'select', 'small', 'span', 'strong', 'textarea']
const voidTags = new Set(['area', 'base', 'br', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const swatches = ['', '#101910', '#9cff58', '#58c7ff', '#ffb84d', '#ff5d5d', '#b98cff']
const storageKey = 'sketcher.document.v1'
const historyLimit = 80

let selectedId = root.id
let activeTag = 'div'
let activeTagGroup: TagGroup | null = null
let activeClass = ''
let showAllTags = false
let includeEmptyClasses = false
let rootManuallyResized = false
let history: string[] = []

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="window-shell">
    <header class="titlebar">
      <div class="title-copy">
        <p class="eyebrow">Sketcher</p>
        <h1>HTML Constructor</h1>
      </div>
      <div class="window-controls" aria-label="Window controls">
        <button id="minimizeWindow" class="minimize-window" type="button" title="Minimize">−</button>
        <button id="maximizeWindow" class="maximize-window" type="button" title="Maximize">□</button>
        <button id="closeWindow" class="close-window" type="button" title="Close">×</button>
      </div>
    </header>

    <section class="toolbar" aria-label="Tools">
      <label>
        <span>Tag</span>
        <select id="tagSelect"></select>
      </label>
      <div class="tag-mode" role="group" aria-label="Tag type">
        <button id="blockTagsButton" type="button">Block</button>
        <button id="inlineTagsButton" type="button">Inline</button>
      </div>
      <label class="class-tool">
        <span>Class</span>
        <input id="classInput" placeholder="class name" />
      </label>
      <div class="file-actions" aria-label="File actions">
        <button id="undoButton" type="button">Undo</button>
        <button id="saveButton" type="button">Save</button>
        <button id="loadButton" type="button">Load</button>
        <button id="clearButton" type="button">Clear</button>
      </div>
    </section>

    <main class="workspace">
      <section class="canvas-wrap">
        <div id="canvas" class="canvas" aria-label="Drawing canvas"></div>
      </section>
      <aside class="side-panel">
        <div class="export-actions side-export">
          <button id="copyButton" type="button">Copy HTML</button>
          <button id="copySelectorsButton" type="button">Copy selectors</button>
        </div>
        <div class="inspector">
          <h2>Selected</h2>
          <div id="selectedEditor"></div>
        </div>
        <details class="tree-panel" open>
          <summary>Structure</summary>
          <div id="treeView"></div>
        </details>
        <details class="html-panel">
          <summary>HTML</summary>
          <pre id="htmlPreview"></pre>
        </details>
        <div class="side-options" aria-label="Sketch options">
          <label class="switch-tool">
            <span>All tags</span>
            <input id="allTagsToggle" type="checkbox" />
          </label>
          <label class="switch-tool">
            <span>Empty classes</span>
            <input id="emptyClassToggle" type="checkbox" />
          </label>
        </div>
      </aside>
    </main>
  </div>
`

const canvasWrap = document.querySelector<HTMLDivElement>('.canvas-wrap')!
const canvas = document.querySelector<HTMLDivElement>('#canvas')!
const tagSelect = document.querySelector<HTMLSelectElement>('#tagSelect')!
const blockTagsButton = document.querySelector<HTMLButtonElement>('#blockTagsButton')!
const inlineTagsButton = document.querySelector<HTMLButtonElement>('#inlineTagsButton')!
const classInput = document.querySelector<HTMLInputElement>('#classInput')!
const allTagsToggle = document.querySelector<HTMLInputElement>('#allTagsToggle')!
const emptyClassToggle = document.querySelector<HTMLInputElement>('#emptyClassToggle')!
const undoButton = document.querySelector<HTMLButtonElement>('#undoButton')!
const saveButton = document.querySelector<HTMLButtonElement>('#saveButton')!
const loadButton = document.querySelector<HTMLButtonElement>('#loadButton')!
const clearButton = document.querySelector<HTMLButtonElement>('#clearButton')!
const copyButton = document.querySelector<HTMLButtonElement>('#copyButton')!
const copySelectorsButton = document.querySelector<HTMLButtonElement>('#copySelectorsButton')!
const minimizeWindowButton = document.querySelector<HTMLButtonElement>('#minimizeWindow')!
const maximizeWindowButton = document.querySelector<HTMLButtonElement>('#maximizeWindow')!
const closeWindowButton = document.querySelector<HTMLButtonElement>('#closeWindow')!
const selectedEditor = document.querySelector<HTMLDivElement>('#selectedEditor')!
const treeView = document.querySelector<HTMLDivElement>('#treeView')!
const htmlPreview = document.querySelector<HTMLPreElement>('#htmlPreview')!

function fitRootToCanvas() {
  if (rootManuallyResized) return
  root.width = Math.max(720, canvasWrap.clientWidth - 48)
  root.height = Math.max(480, canvasWrap.clientHeight - 48)
}

fitRootToCanvas()

function currentTagOptions() {
  if ((activeTagGroup ?? 'block') === 'block') return showAllTags ? blockTags : popularBlockTags
  return showAllTags ? inlineTags : popularInlineTags
}

function setTagGroup(group: TagGroup, nextTag?: string) {
  activeTagGroup = group
  const options = currentTagOptions()
  activeTag = nextTag ?? (options.includes(activeTag) ? activeTag : options[0])
  render()
}

function renderTagSelect(select: HTMLSelectElement, selectedTag: string, includeSelected = false) {
  const options = includeSelected ? (showAllTags ? allTags : Array.from(new Set([...popularBlockTags, ...popularInlineTags, selectedTag])).sort()) : currentTagOptions()
  select.innerHTML = ''
  options.forEach((tag) => select.add(new Option(tag, tag)))
  select.value = selectedTag
}

function uid() {
  return `block-${Math.random().toString(16).slice(2)}`
}

function normalizeNode(node: BlockNode): BlockNode {
  return {
    id: node.id ?? uid(),
    tag: node.tag ?? 'div',
    className: node.className ?? '',
    shadowColor: node.shadowColor ?? '',
    locked: Boolean(node.locked),
    flex: Boolean(node.flex),
    flexDirection: node.flexDirection ?? 'row',
    justifyContent: node.justifyContent ?? 'start',
    alignItems: node.alignItems ?? 'stretch',
    gap: Number(node.gap) || 12,
    flexSnapshot: node.flexSnapshot ?? {},
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    width: Number(node.width) || 80,
    height: Number(node.height) || 60,
    children: (node.children ?? []).map(normalizeNode),
  }
}

function snapshot() {
  return JSON.stringify(root)
}

function restoreSnapshot(value: string) {
  const parsed = normalizeNode(JSON.parse(value))
  Object.assign(root, parsed)
  selectedId = findNode(selectedId) ? selectedId : root.id
}

function pushHistory() {
  history.push(snapshot())
  if (history.length > historyLimit) {
    history = history.slice(history.length - historyLimit)
  }
}

function undo() {
  const previous = history.pop()
  if (!previous) return
  restoreSnapshot(previous)
  render()
}

function flatten(node: BlockNode, depth = 0, parentId: string | null = null): FlatBlock[] {
  return [{ ...node, depth, parentId }, ...node.children.flatMap((child) => flatten(child, depth + 1, node.id))]
}

function findNode(id: string, node = root): BlockNode | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(id, child)
    if (found) return found
  }
  return null
}

function findParent(id: string, node = root): BlockNode | null {
  if (node.children.some((child) => child.id === id)) return node
  for (const child of node.children) {
    const found = findParent(id, child)
    if (found) return found
  }
  return null
}

function ancestorsOf(id: string) {
  const ancestors: BlockNode[] = []

  function walk(node: BlockNode): boolean {
    for (const child of node.children) {
      if (child.id === id) return true
      if (walk(child)) {
        ancestors.unshift(child)
        return true
      }
    }
    return false
  }

  if (id !== root.id && walk(root)) {
    ancestors.unshift(root)
  }

  return ancestors
}

function detachNode(id: string, node = root): BlockNode | null {
  const index = node.children.findIndex((child) => child.id === id)
  if (index >= 0) {
    const [removed] = node.children.splice(index, 1)
    return removed
  }
  for (const child of node.children) {
    const removed = detachNode(id, child)
    if (removed) return removed
  }
  return null
}

function removeNode(id: string, node = root): BlockNode | null {
  const index = node.children.findIndex((child) => child.id === id)
  if (index >= 0) {
    const [removed] = node.children.splice(index, 1)
    node.children.splice(index, 0, ...removed.children)
    return removed
  }
  for (const child of node.children) {
    const removed = removeNode(id, child)
    if (removed) return removed
  }
  return null
}

function cloneNode(node: BlockNode, offsetX = 28, offsetY = 28): BlockNode {
  return {
    ...node,
    id: uid(),
    flexSnapshot: {},
    x: node.x + offsetX,
    y: node.y + offsetY,
    children: node.children.map((child) => cloneNode(child, offsetX, offsetY)),
  }
}

function flexStylesFor(node: BlockNode, level: number) {
  if (!node.flex) return ''

  const indent = '  '.repeat(level + 1)
  return [
    `${indent}display: flex;`,
    `${indent}flex-direction: row;`,
    `${indent}justify-content: space-between;`,
  ].join('\n')
}

function saveFlexSnapshot(parent: BlockNode) {
  parent.flexSnapshot = Object.fromEntries(parent.children.map((child) => [child.id, { x: child.x, y: child.y, width: child.width, height: child.height }]))
}

function restoreFlexSnapshot(parent: BlockNode) {
  parent.children.forEach((child) => {
    const saved = parent.flexSnapshot[child.id]
    if (!saved) return
    child.x = saved.x
    child.y = saved.y
    child.width = saved.width
    child.height = saved.height
  })
  parent.flexSnapshot = {}
}

function applyFlexLayout(parent: BlockNode) {
  if (!parent.flex || parent.locked || !parent.children.length) return

  const padding = 18
  const count = parent.children.length
  const innerLeft = parent.x + padding
  const innerTop = parent.y + padding + 24
  const innerWidth = Math.max(48, parent.width - padding * 2)
  const innerHeight = Math.max(48, parent.height - padding * 2 - 24)
  const savedBox = (child: BlockNode) => parent.flexSnapshot[child.id] ?? child

  const naturalWidths = parent.children.map((child) => Math.max(36, Math.min(savedBox(child).width, innerWidth)))
  const naturalTotal = naturalWidths.reduce((sum, width) => sum + width, 0)
  const availableForItems = Math.max(36 * count, innerWidth)
  const scale = naturalTotal > availableForItems ? availableForItems / naturalTotal : 1
  const itemWidths = naturalWidths.map((width) => width * scale)
  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0)
  const distributedGap = count > 1 ? Math.max(0, (innerWidth - totalWidth) / (count - 1)) : 0
  let currentX = innerLeft

  parent.children.forEach((child, index) => {
    const itemWidth = itemWidths[index]
    const itemHeight = innerHeight
    const nextX = currentX
    const nextY = innerTop
    const dx = nextX - child.x
    const dy = nextY - child.y
    child.x = nextX
    child.width = itemWidth
    child.height = itemHeight
    child.y = nextY
    child.children.forEach((grandChild) => moveNodeWithChildren(grandChild, dx, dy))
    currentX += itemWidth + distributedGap
    applyFlexLayout(child)
  })
}

function moveNodeWithChildren(node: BlockNode, dx: number, dy: number) {
  node.x += dx
  node.y += dy
  node.children.forEach((child) => moveNodeWithChildren(child, dx, dy))
}

function clampMoveDelta(node: BlockNode, dx: number, dy: number) {
  const subtree = flatten(node)
  const minX = Math.min(...subtree.map((item) => item.x))
  const minY = Math.min(...subtree.map((item) => item.y))

  return {
    dx: minX + dx < 0 ? -minX : dx,
    dy: minY + dy < 0 ? -minY : dy,
  }
}

function areaInside(child: BlockNode, parent: BlockNode) {
  const left = Math.max(child.x, parent.x)
  const top = Math.max(child.y, parent.y)
  const right = Math.min(child.x + child.width, parent.x + parent.width)
  const bottom = Math.min(child.y + child.height, parent.y + parent.height)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function chooseParent(block: BlockNode, ignoredIds = new Set<string>()) {
  const candidates = flatten(root).filter((item) => item.id !== block.id && !ignoredIds.has(item.id))
  const blockArea = block.width * block.height
  const matching = candidates
    .map((candidate) => ({ candidate, ratio: areaInside(block, candidate) / blockArea }))
    .filter((item) => item.ratio >= 0.5)
    .sort((a, b) => b.candidate.depth - a.candidate.depth || a.candidate.width * a.candidate.height - b.candidate.width * b.candidate.height)

  return findNode(matching[0]?.candidate.id ?? root.id) ?? root
}

function syncMovedNodeHierarchy(node: BlockNode) {
  if (node.id === root.id) return

  const subtreeIds = new Set(flatten(node).map((item) => item.id))
  const nextParent = chooseParent(node, subtreeIds)
  const currentParent = findParent(node.id)

  if (currentParent?.id !== nextParent.id) {
    const detached = detachNode(node.id)
    if (detached) {
      nextParent.children.push(detached)
      applyFlexLayout(nextParent)
    }
  } else if (currentParent?.flex) {
    applyFlexLayout(currentParent)
  }
}

function deleteSelectedBlock() {
  const selected = findNode(selectedId)
  if (!selected || selected.id === root.id || selected.locked) return
  pushHistory()
  removeNode(selectedId)
  selectedId = root.id
  render()
}

function copySelectedBlock() {
  const selected = findNode(selectedId)
  const parent = selected ? findParent(selected.id) : null
  if (!selected || !parent || selected.id === root.id || selected.locked) return
  pushHistory()
  const clone = cloneNode(selected)
  parent.children.push(clone)
  applyFlexLayout(parent)
  selectedId = clone.id
  render()
}

function saveDocument() {
  localStorage.setItem(storageKey, snapshot())
}

function loadDocument() {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return
  pushHistory()
  restoreSnapshot(saved)
  render()
}

function clearDocument() {
  pushHistory()
  root.children = []
  selectedId = root.id
  rootManuallyResized = false
  fitRootToCanvas()
  render()
}

function getLabel(block: BlockNode) {
  return `${block.tag}${block.className ? `.${block.className}` : '.-'}`
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;')
}

function safeColor(value: string) {
  return /^#[\da-f]{3,8}$/i.test(value) ? value : ''
}

function htmlFor(node: BlockNode, level = 0): string {
  const indent = '  '.repeat(level)
  const classPart = node.className || includeEmptyClasses ? ` class="${escapeAttr(node.className)}"` : ''
  const open = `${indent}<${node.tag}${classPart}>`
  const close = `${indent}</${node.tag}>`

  if (voidTags.has(node.tag)) {
    return open
  }

  if (!node.children.length) {
    return `${indent}<${node.tag}${classPart}></${node.tag}>`
  }

  return `${open}\n${node.children.map((child) => htmlFor(child, level + 1)).join('\n')}\n${close}`
}

function selectorFor(node: BlockNode, level = 0): string {
  const indent = '  '.repeat(level)
  const selector = node.className ? `.${node.className}` : node.tag
  const flexStyles = flexStylesFor(node, level)

  if (!node.children.length && !flexStyles) {
    return `${indent}${selector} {\n${indent}}`
  }

  const body = [flexStyles, node.children.map((child) => selectorFor(child, level + 1)).join('\n\n')].filter(Boolean).join('\n\n')

  return `${indent}${selector} {\n${body}\n${indent}}`
}

function nestingIssue(node: BlockNode) {
  const parent = findParent(node.id)
  const parentTag = parent?.tag
  const ancestorTags = ancestorsOf(node.id).map((ancestor) => ancestor.tag)

  if (voidTags.has(node.tag) && node.children.length) return `${node.tag} cannot have children`
  if (parentTag && !isValidHTMLNesting(parentTag, node.tag)) return `${node.tag} should not be inside ${parentTag}`

  if (node.tag === 'li' && !['ul', 'ol', 'menu'].includes(parentTag ?? '')) return 'li should be inside ul, ol, or menu'
  if (['ul', 'ol', 'menu'].includes(parentTag ?? '') && node.tag !== 'li') return `${node.tag} should not be a direct child of ${parentTag}`
  if (node.tag === 'tr' && !['table', 'thead', 'tbody', 'tfoot'].includes(parentTag ?? '')) return 'tr should be inside table, thead, tbody, or tfoot'
  if (['thead', 'tbody', 'tfoot'].includes(node.tag) && parentTag !== 'table') return `${node.tag} should be inside table`
  if (node.tag === 'caption' && parentTag !== 'table') return 'caption should be inside table'
  if (parentTag === 'table' && !['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr'].includes(node.tag)) return `${node.tag} should not be a direct child of table`
  if (['thead', 'tbody', 'tfoot'].includes(parentTag ?? '') && node.tag !== 'tr') return `${node.tag} should not be a direct child of ${parentTag}`
  if (parentTag === 'tr' && !['td', 'th'].includes(node.tag)) return `${node.tag} should not be a direct child of tr`
  if (['td', 'th'].includes(node.tag) && parentTag !== 'tr') return `${node.tag} should be inside tr`
  if (node.tag === 'figcaption' && parentTag !== 'figure') return 'figcaption should be inside figure'
  if (node.tag === 'option' && !['select', 'datalist', 'optgroup'].includes(parentTag ?? '')) return 'option should be inside select'
  if (node.tag === 'summary' && parentTag !== 'details') return 'summary should be inside details'
  if (['dt', 'dd'].includes(node.tag) && parentTag !== 'dl') return `${node.tag} should be inside dl`
  if (node.tag === 'form' && ancestorTags.includes('form')) return 'form should not be inside another form'

  if (node.tag === 'a' && ancestorTags.includes('a')) return 'a should not be inside another a'
  if (ancestorTags.includes('a') && ['button', 'input', 'select', 'textarea', 'label'].includes(node.tag)) {
    return `${node.tag} should not be inside a`
  }
  if (ancestorTags.includes('a') && ['article', 'section', 'header', 'footer', 'nav', 'main', 'aside', 'ul', 'ol', 'li', 'table', 'form'].includes(node.tag)) {
    return `${node.tag} inside a is suspicious`
  }

  if (parentTag === 'button' && ['a', 'button', 'input', 'select', 'textarea'].includes(node.tag)) {
    return `${node.tag} should not be inside button`
  }

  return ''
}

function render() {
  const blocks = flatten(root)
  const selected = findNode(selectedId) ?? root
  const canUseFlex = selected.children.length > 0
  selectedId = selected.id
  const contentRight = Math.max(...blocks.map((block) => block.x + block.width + 24))
  const contentBottom = Math.max(...blocks.map((block) => block.y + block.height + 24))
  canvas.style.width = `${Math.ceil(Math.max(contentRight, canvasWrap.clientWidth))}px`
  canvas.style.height = `${Math.ceil(Math.max(contentBottom, canvasWrap.clientHeight))}px`

  tagSelect.value = activeTag
  renderTagSelect(tagSelect, activeTag)
  blockTagsButton.classList.toggle('active', activeTagGroup === 'block')
  inlineTagsButton.classList.toggle('active', activeTagGroup === 'inline')
  classInput.value = activeClass
  allTagsToggle.checked = showAllTags
  emptyClassToggle.checked = includeEmptyClasses

  canvas.innerHTML = ''
  canvas.innerHTML = `
    <span class="canvas-guide guide-top">TOP</span>
    <span class="canvas-guide guide-right">RIGHT</span>
    <span class="canvas-guide guide-bottom">BOTTOM</span>
    <span class="canvas-guide guide-left">LEFT</span>
    ${
      moveGuide
        ? `<span class="move-guide guide-top-edge" style="top:${moveGuide.top}px"></span>
           <span class="move-guide guide-bottom-edge" style="top:${moveGuide.bottom}px"></span>
           <span class="move-guide guide-left-edge" style="left:${moveGuide.left}px"></span>
           <span class="move-guide guide-right-edge" style="left:${moveGuide.right}px"></span>`
        : ''
    }
  `
  blocks.forEach((block) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `block ${block.id === selectedId ? 'selected' : ''}`
    el.style.left = `${block.x}px`
    el.style.top = `${block.y}px`
    el.style.width = `${block.width}px`
    el.style.height = `${block.height}px`
    el.style.zIndex = String(block.depth + 1)
    el.style.background = voidTags.has(block.tag) ? 'rgba(0, 0, 0, 0.88)' : `rgba(0, 0, 0, ${0.035 + block.depth * 0.035})`
    el.style.borderColor = block.id === root.id ? '#9cff58' : '#89e85a'
    const shadows = []
    if (block.shadowColor) {
      shadows.push(`0 0 0 2px ${block.shadowColor}`, `0 0 18px ${block.shadowColor}`)
    }
    if (block.id === selectedId) {
      shadows.push('inset 0 0 0 1px #0f180e', '0 0 0 2px rgba(167, 255, 63, 0.65)')
    }
    if (shadows.length) {
      el.style.boxShadow = shadows.join(', ')
    }
    el.dataset.id = block.id
    el.innerHTML = `
      <span class="block-label" data-id="${block.id}">
        <strong>${block.tag}.</strong><input data-class-id="${block.id}" value="${escapeAttr(block.className)}" placeholder="-" ${block.locked ? 'disabled' : ''}>
      </span>
      <span class="resize-handle" data-resize-id="${block.id}" aria-hidden="true"></span>
    `
    canvas.append(el)
  })

  selectedEditor.innerHTML = `
    <label><span>Tag</span><select id="selectedTag" ${selected.locked ? 'disabled' : ''}></select></label>
    <label><span>Class</span><input id="selectedClass" value="${escapeAttr(selected.className)}" placeholder="-" ${selected.id === root.id || selected.locked ? 'disabled' : ''}></label>
    <div class="selected-actions">
      <button id="lockSelectedButton" type="button">${selected.locked ? 'Unlock' : 'Lock'}</button>
      <button id="copySelectedButton" type="button" ${selected.id === root.id || selected.locked ? 'disabled' : ''}>Copy</button>
      <button id="deleteSelectedPanelButton" type="button" ${selected.id === root.id || selected.locked ? 'disabled' : ''}>Delete</button>
    </div>
    <div class="flex-panel ${selected.flex ? 'active' : ''}">
      <label class="switch-tool">
        <span>Flex</span>
        <input id="selectedFlex" type="checkbox" ${selected.flex ? 'checked' : ''} ${selected.locked || !canUseFlex ? 'disabled' : ''}>
      </label>
    </div>
    <div class="swatches">${swatches.map((color) => `<button type="button" data-color="${color}" style="--swatch:${color || 'transparent'}" aria-label="${color || 'default'}"></button>`).join('')}</div>
  `

  treeView.innerHTML = blocks
    .map((block) => {
      const issue = nestingIssue(block)
      const treeColor = safeColor(block.shadowColor)
      const colorClass = treeColor ? 'has-shadow-color' : ''
      const colorStyle = treeColor ? `;--tree-color:${treeColor}` : ''
      return `<button type="button" class="${block.id === selectedId ? 'active' : ''} ${issue ? 'invalid' : ''} ${colorClass}" data-id="${block.id}" title="${escapeAttr(issue ?? '')}" style="margin-left:${block.depth * 16}px;width:calc(100% - ${block.depth * 16}px)${colorStyle}">${escapeHtml(getLabel(block))}</button>`
    })
    .join('')

  htmlPreview.textContent = htmlFor(root)

  const selectedTagSelect = document.querySelector<HTMLSelectElement>('#selectedTag')!
  renderTagSelect(selectedTagSelect, selected.tag, true)
  selectedTagSelect.addEventListener('change', (event) => {
    if (selected.locked) return
    pushHistory()
    selected.tag = (event.target as HTMLSelectElement).value
    render()
  })
  const selectedClassInput = document.querySelector<HTMLInputElement>('#selectedClass')!
  selectedClassInput.addEventListener('change', (event) => {
    if (selected.locked) return
    pushHistory()
    selected.className = (event.target as HTMLInputElement).value.trim()
    render()
  })
  selectedClassInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      selectedClassInput.blur()
    }
  })
  selectedEditor.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      if (selected.locked) return
      pushHistory()
      selected.shadowColor = button.dataset.color ?? ''
      render()
    })
  })
  document.querySelector<HTMLButtonElement>('#lockSelectedButton')!.addEventListener('click', () => {
    pushHistory()
    selected.locked = !selected.locked
    render()
  })
  document.querySelector<HTMLButtonElement>('#copySelectedButton')!.addEventListener('click', () => {
    copySelectedBlock()
  })
  document.querySelector<HTMLButtonElement>('#deleteSelectedPanelButton')!.addEventListener('click', () => {
    deleteSelectedBlock()
  })
  document.querySelector<HTMLInputElement>('#selectedFlex')!.addEventListener('change', (event) => {
    if (selected.locked || !canUseFlex) return
    pushHistory()
    selected.flex = (event.target as HTMLInputElement).checked
    if (selected.flex) {
      selected.flexDirection = 'row'
      selected.justifyContent = 'start'
      selected.alignItems = 'stretch'
      selected.gap = 0
      saveFlexSnapshot(selected)
      applyFlexLayout(selected)
    } else {
      restoreFlexSnapshot(selected)
    }
    render()
  })
}

function canvasPoint(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(event.clientX - rect.left + canvas.scrollLeft, canvas.scrollWidth)),
    y: Math.max(0, Math.min(event.clientY - rect.top + canvas.scrollTop, canvas.scrollHeight)),
  }
}

let draft: BlockNode | null = null
let resizing: BlockNode | null = null
let moving: BlockNode | null = null
let movedDuringDrag = false
let moveGuide: { left: number; right: number; top: number; bottom: number } | null = null
let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0
let lastMoveX = 0
let lastMoveY = 0
let interactionSnapshot: string | null = null

canvas.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement

  const resizeHandle = target.closest<HTMLElement>('[data-resize-id]')
  if (resizeHandle) {
    const node = findNode(resizeHandle.dataset.resizeId ?? root.id)
    if (!node || node.locked) return
    const point = canvasPoint(event)
    selectedId = node.id
    resizing = node
    interactionSnapshot = snapshot()
    startX = point.x
    startY = point.y
    startWidth = node.width
    startHeight = node.height
    canvas.setPointerCapture(event.pointerId)
    render()
    return
  }

  const labelInput = target.closest<HTMLInputElement>('input[data-class-id]')
  if (labelInput) {
    selectedId = labelInput.dataset.classId ?? root.id
    return
  }

  const label = target.closest<HTMLElement>('[data-id]')
  if (label) {
    const node = findNode(label.dataset.id ?? root.id)
    if (!node) return
    if (node.locked) {
      selectedId = node.id
      render()
      return
    }
    const point = canvasPoint(event)
    selectedId = node.id
    moving = node
    interactionSnapshot = snapshot()
    movedDuringDrag = false
    startX = point.x
    startY = point.y
    lastMoveX = point.x
    lastMoveY = point.y
    canvas.setPointerCapture(event.pointerId)
    render()
    return
  }

  const point = canvasPoint(event)
  if (!activeTagGroup) return

  startX = point.x
  startY = point.y
  draft = {
    id: uid(),
    tag: activeTag,
    className: activeClass.trim(),
    shadowColor: '',
    locked: false,
    flex: false,
    flexDirection: 'row',
    justifyContent: 'start',
    alignItems: 'stretch',
    gap: 12,
    flexSnapshot: {},
    x: startX,
    y: startY,
    width: 1,
    height: 1,
    children: [],
  }
  canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  if (moving) {
    const point = canvasPoint(event)
    const dx = point.x - startX
    const dy = point.y - startY
    movedDuringDrag ||= Math.abs(dx) > 3 || Math.abs(dy) > 3
    const delta = clampMoveDelta(moving, point.x - lastMoveX, point.y - lastMoveY)
    moveNodeWithChildren(moving, delta.dx, delta.dy)
    lastMoveX += delta.dx
    lastMoveY += delta.dy
    moveGuide = {
      left: moving.x,
      right: moving.x + moving.width,
      top: moving.y,
      bottom: moving.y + moving.height,
    }
    render()
    return
  }

  if (resizing) {
    const point = canvasPoint(event)
    resizing.width = Math.max(36, startWidth + point.x - startX)
    resizing.height = Math.max(28, startHeight + point.y - startY)
    render()
    return
  }

  if (!draft) return
  const point = canvasPoint(event)
  draft.x = Math.min(startX, point.x)
  draft.y = Math.min(startY, point.y)
  draft.width = Math.abs(point.x - startX)
  draft.height = Math.abs(point.y - startY)
  render()
  const preview = document.createElement('div')
  preview.className = 'draft-block'
  preview.style.left = `${draft.x}px`
  preview.style.top = `${draft.y}px`
  preview.style.width = `${draft.width}px`
  preview.style.height = `${draft.height}px`
  canvas.append(preview)
})

canvas.addEventListener('pointerup', (event) => {
  if (moving) {
    canvas.releasePointerCapture(event.pointerId)
    const movedNodeId = moving.id
    if (movedDuringDrag) {
      if (interactionSnapshot) {
        history.push(interactionSnapshot)
        if (history.length > historyLimit) history = history.slice(history.length - historyLimit)
      }
      syncMovedNodeHierarchy(moving)
    }
    moving = null
    moveGuide = null
    interactionSnapshot = null
    render()
    if (!movedDuringDrag) {
      const inlineInput = canvas.querySelector<HTMLInputElement>(`input[data-class-id="${movedNodeId}"]`)
      inlineInput?.focus()
      inlineInput?.select()
    }
    return
  }

  if (resizing) {
    canvas.releasePointerCapture(event.pointerId)
    if (interactionSnapshot) {
      history.push(interactionSnapshot)
      if (history.length > historyLimit) history = history.slice(history.length - historyLimit)
    }
    if (resizing.id === root.id) {
      rootManuallyResized = true
    }
    applyFlexLayout(resizing)
    resizing = null
    interactionSnapshot = null
    render()
    return
  }

  if (!draft) return
  canvas.releasePointerCapture(event.pointerId)
  if (draft.width > 18 && draft.height > 18) {
    pushHistory()
    const parent = chooseParent(draft)
    parent.children.push(draft)
    applyFlexLayout(parent)
    selectedId = draft.id
  }
  draft = null
  render()
})

tagSelect.addEventListener('change', () => {
  activeTag = tagSelect.value
})

blockTagsButton.addEventListener('click', () => {
  if (activeTagGroup === 'block') {
    activeTagGroup = null
    render()
    return
  }
  setTagGroup('block')
})

inlineTagsButton.addEventListener('click', () => {
  if (activeTagGroup === 'inline') {
    activeTagGroup = null
    render()
    return
  }
  setTagGroup('inline')
})

classInput.addEventListener('input', () => {
  activeClass = classInput.value
})

allTagsToggle.addEventListener('change', () => {
  showAllTags = allTagsToggle.checked
  const options = currentTagOptions()
  activeTag = options.includes(activeTag) ? activeTag : options[0]
  render()
})

emptyClassToggle.addEventListener('change', () => {
  includeEmptyClasses = emptyClassToggle.checked
  render()
})

undoButton.addEventListener('click', undo)
saveButton.addEventListener('click', saveDocument)
loadButton.addEventListener('click', loadDocument)
clearButton.addEventListener('click', clearDocument)

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(htmlFor(root))
  copyButton.textContent = 'Copied'
  window.setTimeout(() => {
    copyButton.textContent = 'Copy HTML'
  }, 900)
})

copySelectorsButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(selectorFor(root))
  copySelectorsButton.textContent = 'Copied'
  window.setTimeout(() => {
    copySelectorsButton.textContent = 'Copy selectors'
  }, 900)
})

minimizeWindowButton.addEventListener('click', () => {
  void window.markupSketcherWindow?.minimize()
})

maximizeWindowButton.addEventListener('click', () => {
  void window.markupSketcherWindow?.toggleMaximize()
})

closeWindowButton.addEventListener('click', () => {
  void window.markupSketcherWindow?.close()
})

canvas.addEventListener('change', (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-class-id]')
  if (!input) return
  const node = findNode(input.dataset.classId ?? '')
  if (!node || node.locked) return
  pushHistory()
  node.className = input.value.trim()
  selectedId = node.id
  render()
})

canvas.addEventListener('keydown', (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-class-id]')
  if (!input) return
  event.stopPropagation()
  if (event.key === 'Enter') {
    input.blur()
  }
})

treeView.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]')
  if (!button) return
  selectedId = button.dataset.id ?? root.id
  render()
})

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId !== root.id) {
    event.preventDefault()
    deleteSelectedBlock()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    copySelectedBlock()
  }
})

window.addEventListener('resize', () => {
  fitRootToCanvas()
  render()
})

render()
