import './style.css'
import { Copy, Pencil, Trash2, type IconNode } from 'lucide'

type BlockNode = {
  id: string
  tag: string
  className: string
  color: string
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

const root: BlockNode = {
  id: 'inner',
  tag: 'div',
  className: 'inner',
  color: '',
  x: 24,
  y: 24,
  width: 1420,
  height: 620,
  children: [],
}

const tagOptions = ['div', 'header', 'main', 'footer', 'section', 'article', 'aside', 'nav', 'ul', 'li', 'button', 'span', 'figure']
const presets = [
  { label: 'Free block', tag: 'div', className: '' },
  { label: 'Dropdown', tag: 'div', className: 'dropdown' },
  { label: 'Toggle', tag: 'button', className: 'toggle' },
]
const swatches = ['', '#c8ff72', '#91e5ff', '#ffd166', '#f4a7b9', '#b8a4ff']
const editIcon = iconSvg(Pencil)
const copyIcon = iconSvg(Copy)
const deleteIcon = iconSvg(Trash2)

let selectedId = root.id
let activeTag = 'div'
let activeClass = ''
let includeEmptyClasses = false
let copied = false
let selectorsCopied = false

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="window-shell">
    <header class="titlebar">
      <div>
        <p class="eyebrow">Markup Sketcher</p>
        <h1>HTML Constructor</h1>
      </div>
      <div class="window-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </header>

    <section class="toolbar" aria-label="Tools">
      <label>
        <span>Preset</span>
        <select id="presetSelect"></select>
      </label>
      <label>
        <span>Tag</span>
        <select id="tagSelect"></select>
      </label>
      <label class="class-tool">
        <span>Class</span>
        <input id="classInput" placeholder="class name" />
      </label>
      <label class="check-tool">
        <input id="emptyClassToggle" type="checkbox" />
        <span>Empty classes</span>
      </label>
      <button id="copyButton" type="button">Copy HTML</button>
      <button id="copySelectorsButton" type="button">Copy selectors</button>
      <button id="deleteButton" type="button">Delete selected</button>
    </section>

    <main class="workspace">
      <section class="canvas-wrap">
        <div id="canvas" class="canvas" aria-label="Drawing canvas"></div>
      </section>
      <aside class="side-panel">
        <div class="inspector">
          <h2>Selected</h2>
          <div id="selectedEditor"></div>
        </div>
        <div class="tree-panel">
          <h2>Structure</h2>
          <div id="treeView"></div>
        </div>
        <div class="html-panel">
          <h2>HTML</h2>
          <pre id="htmlPreview"></pre>
        </div>
      </aside>
    </main>
  </div>
`

const canvas = document.querySelector<HTMLDivElement>('#canvas')!
const presetSelect = document.querySelector<HTMLSelectElement>('#presetSelect')!
const tagSelect = document.querySelector<HTMLSelectElement>('#tagSelect')!
const classInput = document.querySelector<HTMLInputElement>('#classInput')!
const emptyClassToggle = document.querySelector<HTMLInputElement>('#emptyClassToggle')!
const copyButton = document.querySelector<HTMLButtonElement>('#copyButton')!
const copySelectorsButton = document.querySelector<HTMLButtonElement>('#copySelectorsButton')!
const deleteButton = document.querySelector<HTMLButtonElement>('#deleteButton')!
const selectedEditor = document.querySelector<HTMLDivElement>('#selectedEditor')!
const treeView = document.querySelector<HTMLDivElement>('#treeView')!
const htmlPreview = document.querySelector<HTMLPreElement>('#htmlPreview')!

tagOptions.forEach((tag) => tagSelect.add(new Option(tag, tag)))
presets.forEach((preset, index) => presetSelect.add(new Option(preset.label, String(index))))

function uid() {
  return `block-${Math.random().toString(16).slice(2)}`
}

function iconSvg(icon: IconNode) {
  const children = icon
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(' ')
      return `<${tag} ${attributes}></${tag}>`
    })
    .join('')

  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`
}

function createPresetChildren(parent: BlockNode) {
  if (parent.className !== 'dropdown') return []

  const closeSize = {
    width: Math.min(96, Math.max(64, parent.width * 0.22)),
    height: 28,
  }

  return [
    {
      id: uid(),
      tag: 'span',
      className: 'close',
      color: '#e8edf0',
      x: parent.x + parent.width - closeSize.width - 12,
      y: parent.y + 10,
      width: closeSize.width,
      height: closeSize.height,
      children: [],
    },
  ]
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
    x: node.x + offsetX,
    y: node.y + offsetY,
    children: node.children.map((child) => cloneNode(child, offsetX, offsetY)),
  }
}

function moveNodeWithChildren(node: BlockNode, dx: number, dy: number) {
  node.x = Math.max(0, node.x + dx)
  node.y = Math.max(0, node.y + dy)
  node.children.forEach((child) => moveNodeWithChildren(child, dx, dy))
}

function areaInside(child: BlockNode, parent: BlockNode) {
  const left = Math.max(child.x, parent.x)
  const top = Math.max(child.y, parent.y)
  const right = Math.min(child.x + child.width, parent.x + parent.width)
  const bottom = Math.min(child.y + child.height, parent.y + parent.height)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function chooseParent(block: BlockNode) {
  const candidates = flatten(root).filter((item) => item.id !== block.id)
  const blockArea = block.width * block.height
  const matching = candidates
    .map((candidate) => ({ candidate, ratio: areaInside(block, candidate) / blockArea }))
    .filter((item) => item.ratio >= 0.5)
    .sort((a, b) => b.candidate.depth - a.candidate.depth || a.candidate.width * a.candidate.height - b.candidate.width * b.candidate.height)

  return findNode(matching[0]?.candidate.id ?? root.id) ?? root
}

function getLabel(block: BlockNode) {
  return `${block.tag}${block.className ? `.${block.className}` : '.-'}`
}

function escapeAttr(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function htmlFor(node: BlockNode, level = 0): string {
  const indent = '  '.repeat(level)
  const classPart = node.className || includeEmptyClasses ? ` class="${escapeAttr(node.className)}"` : ''
  const comment = `${indent}<!-- ${getLabel(node)} -->`
  const open = `${indent}<${node.tag}${classPart}>`
  const close = `${indent}</${node.tag}>`

  if (!node.children.length) {
    return `${comment}\n${indent}<${node.tag}${classPart}></${node.tag}>`
  }

  return `${comment}\n${open}\n${node.children.map((child) => htmlFor(child, level + 1)).join('\n\n')}\n${close}`
}

function selectorFor(node: BlockNode, level = 0): string {
  const indent = '  '.repeat(level)
  const selector = node.className ? `.${node.className}` : `/* ${getLabel(node)} */`

  if (!node.children.length) {
    return `${indent}${selector} {\n${indent}}`
  }

  return `${indent}${selector} {\n${node.children.map((child) => selectorFor(child, level + 1)).join('\n\n')}\n${indent}}`
}

function render() {
  const blocks = flatten(root)
  const selected = findNode(selectedId) ?? root
  selectedId = selected.id

  tagSelect.value = activeTag
  classInput.value = activeClass
  emptyClassToggle.checked = includeEmptyClasses

  canvas.innerHTML = ''
  blocks.forEach((block) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `block ${block.id === selectedId ? 'selected' : ''}`
    el.style.left = `${block.x}px`
    el.style.top = `${block.y}px`
    el.style.width = `${block.width}px`
    el.style.height = `${block.height}px`
    el.style.zIndex = String(block.depth + 1)
    el.style.background = block.color || `rgba(0, 0, 0, ${0.035 + block.depth * 0.035})`
    el.style.borderColor = block.id === root.id ? '#9cff58' : '#89e85a'
    el.dataset.id = block.id
    el.innerHTML = `
      <span class="block-label" data-id="${block.id}">
        <strong>${block.tag}.</strong><input data-class-id="${block.id}" value="${escapeAttr(block.className)}" placeholder="-">
      </span>
      <span class="block-actions">
        <button class="edit-action" type="button" data-edit-id="${block.id}" title="Edit">${editIcon}</button>
        ${block.id === root.id ? '' : `<button class="copy-action" type="button" data-copy-id="${block.id}" title="Copy">${copyIcon}</button>`}
        ${block.id === root.id ? '' : `<button class="delete-action" type="button" data-delete-id="${block.id}" title="Delete">${deleteIcon}</button>`}
      </span>
      <span class="resize-handle" data-resize-id="${block.id}" aria-hidden="true"></span>
    `
    canvas.append(el)
  })

  selectedEditor.innerHTML = `
    <label><span>Tag</span><select id="selectedTag">${tagOptions.map((tag) => `<option value="${tag}" ${tag === selected.tag ? 'selected' : ''}>${tag}</option>`).join('')}</select></label>
    <label><span>Class</span><input id="selectedClass" value="${escapeAttr(selected.className)}" placeholder="-" ${selected.id === root.id ? 'disabled' : ''}></label>
    <div class="swatches">${swatches.map((color) => `<button type="button" data-color="${color}" style="--swatch:${color || 'transparent'}" aria-label="${color || 'default'}"></button>`).join('')}</div>
  `

  treeView.innerHTML = blocks
    .map((block) => `<button type="button" class="${block.id === selectedId ? 'active' : ''}" data-id="${block.id}" style="padding-left:${10 + block.depth * 16}px">${getLabel(block)}</button>`)
    .join('')

  htmlPreview.textContent = htmlFor(root)

  document.querySelector<HTMLSelectElement>('#selectedTag')!.addEventListener('change', (event) => {
    selected.tag = (event.target as HTMLSelectElement).value
    render()
  })
  const selectedClassInput = document.querySelector<HTMLInputElement>('#selectedClass')!
  selectedClassInput.addEventListener('change', (event) => {
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
      selected.color = button.dataset.color ?? ''
      render()
    })
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
let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0
let lastMoveX = 0
let lastMoveY = 0

canvas.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement

  const resizeHandle = target.closest<HTMLElement>('[data-resize-id]')
  if (resizeHandle) {
    const node = findNode(resizeHandle.dataset.resizeId ?? root.id)
    if (!node) return
    const point = canvasPoint(event)
    selectedId = node.id
    resizing = node
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

  const editButton = target.closest<HTMLButtonElement>('[data-edit-id]')
  if (editButton) {
    event.stopPropagation()
    selectedId = editButton.dataset.editId ?? root.id
    render()
    const inlineInput = canvas.querySelector<HTMLInputElement>(`input[data-class-id="${selectedId}"]`)
    inlineInput?.focus()
    inlineInput?.select()
    return
  }

  const copyButton = target.closest<HTMLButtonElement>('[data-copy-id]')
  if (copyButton) {
    event.stopPropagation()
    const node = findNode(copyButton.dataset.copyId ?? '')
    const parent = node ? findParent(node.id) : null
    if (node && parent) {
      const clone = cloneNode(node)
      parent.children.push(clone)
      selectedId = clone.id
      render()
    }
    return
  }

  const deleteButton = target.closest<HTMLButtonElement>('[data-delete-id]')
  if (deleteButton) {
    event.stopPropagation()
    selectedId = deleteButton.dataset.deleteId ?? root.id
    if (selectedId !== root.id) {
      removeNode(selectedId)
      selectedId = root.id
      render()
    }
    return
  }

  const label = target.closest<HTMLElement>('[data-id]')
  if (label) {
    const node = findNode(label.dataset.id ?? root.id)
    if (!node) return
    const point = canvasPoint(event)
    selectedId = node.id
    moving = node
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
  startX = point.x
  startY = point.y
  draft = {
    id: uid(),
    tag: activeTag,
    className: activeClass.trim(),
    color: '',
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
    moveNodeWithChildren(moving, point.x - lastMoveX, point.y - lastMoveY)
    lastMoveX = point.x
    lastMoveY = point.y
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
    moving = null
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
    resizing = null
    render()
    return
  }

  if (!draft) return
  canvas.releasePointerCapture(event.pointerId)
  if (draft.width > 18 && draft.height > 18) {
    draft.children = createPresetChildren(draft)
    const parent = chooseParent(draft)
    parent.children.push(draft)
    selectedId = draft.id
  }
  draft = null
  render()
})

presetSelect.addEventListener('change', () => {
  const preset = presets[Number(presetSelect.value)]
  activeTag = preset.tag
  activeClass = preset.className
  render()
})

tagSelect.addEventListener('change', () => {
  activeTag = tagSelect.value
  presetSelect.value = '0'
})

classInput.addEventListener('input', () => {
  activeClass = classInput.value
  presetSelect.value = '0'
})

emptyClassToggle.addEventListener('change', () => {
  includeEmptyClasses = emptyClassToggle.checked
  render()
})

deleteButton.addEventListener('click', () => {
  if (selectedId === root.id) return
  removeNode(selectedId)
  selectedId = root.id
  render()
})

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(htmlFor(root))
  copied = true
  copyButton.textContent = 'Copied'
  window.setTimeout(() => {
    copied = false
    copyButton.textContent = copied ? 'Copied' : 'Copy HTML'
  }, 900)
})

copySelectorsButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(selectorFor(root))
  selectorsCopied = true
  copySelectorsButton.textContent = 'Copied'
  window.setTimeout(() => {
    selectorsCopied = false
    copySelectorsButton.textContent = selectorsCopied ? 'Copied' : 'Copy selectors'
  }, 900)
})

canvas.addEventListener('change', (event) => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-class-id]')
  if (!input) return
  const node = findNode(input.dataset.classId ?? '')
  if (!node) return
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
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId !== root.id) {
    event.preventDefault()
    removeNode(selectedId)
    selectedId = root.id
    render()
  }
})

render()
