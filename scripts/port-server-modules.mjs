#!/usr/bin/env node
/**
 * One-off: port frontbet/src/server/*.ts → betfront/src/server/*.ts.
 *
 * Mechanical transforms:
 *   - drop the leading `'use server'`
 *   - drop  `import { createServerFn } from '@tanstack/react-start'`
 *   - rewrite hardcoded `/home/gion/Apps/bet/...` → `/home/gion/Projects/bet/...`
 *   - rewrite each `export const X = createServerFn({...}).inputValidator(VAL).handler(async ({data}) => BODY)`
 *     into a plain async function:
 *         export async function X(data: <inferred>): Promise<...> { const _v = (VAL); BODY }
 *     For functions with no validator: `.handler(async () => BODY)` → `export async function X() { BODY }`
 *
 * Strategy: regex-based with fallback to manual review markers.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = '/home/gion/Projects/bet/frontbet/src/server'
const DST_DIR = '/home/gion/Projects/bet/betfront/src/server'

const FILES = [
  'datasets.ts',
  'tickets.ts',
  'predictions.ts',
  'scraper.ts',
  'penaltyblog.ts',
  'penaltyblog.helpers.ts',
  'soccerdata.ts',
]

mkdirSync(DST_DIR, { recursive: true })

// Path remap: hardcoded /home/gion/Apps/bet/<project>/... → resolve sibling directory of betfront.
// Bridge files live at betfront/scripts/*.py instead of frontbet/scripts/*.py.
function remapPaths(src) {
  return src
    .replace(/\/home\/gion\/Apps\/bet\/frontbet\/scripts\//g, "${import.meta.dirname}/../../scripts/")
    .replace(/\/home\/gion\/Apps\/bet\/(penaltyblog|soccerdata|OddsHarvester)\//g, "${import.meta.dirname}/../../../$1/")
}

// Convert path.resolve('<absolute>') with embedded ${...} expressions →
// path.resolve(import.meta.dirname, '<relative>')
function rewritePathResolve(src) {
  // Match: path.resolve('/home/gion/Apps/bet/<sub>/...')  with already-mangled string.
  // After remapPaths, absolute strings still use single quotes; switch to template literals.
  return src.replace(
    /path\.resolve\(\s*'(\$\{[^']+)'(?=\s*[,)])/g,
    (_, body) => "path.resolve(`" + body + "`",
  )
}

function stripUseServer(src) {
  return src.replace(/^['"]use server['"]\s*\n+/, '')
}

function stripCreateServerFnImport(src) {
  return src.replace(
    /^import\s*\{[^}]*createServerFn[^}]*\}\s*from\s*['"]@tanstack\/react-start['"];?\s*\n/m,
    '',
  )
}

/**
 * Convert createServerFn chains. Two shapes:
 *
 *   export const NAME = createServerFn({ method: '...' })
 *     .inputValidator((data: T) => SCHEMA.parse(data))
 *     .handler(async ({ data }) => { BODY })
 *
 *   export const NAME = createServerFn({ method: 'GET' }).handler(async () => { BODY })
 *   export const NAME = createServerFn({ method: 'GET' }).handler(async () => BODY,)   // single-expr
 *
 * Approach: walk the file finding `export const NAME = createServerFn(`, then capture
 * matching parentheses by counting depth.
 */
function transformCreateServerFn(src) {
  const out = []
  let i = 0
  const N = src.length

  while (i < N) {
    const startIdx = src.indexOf('createServerFn(', i)
    if (startIdx === -1) {
      out.push(src.slice(i))
      break
    }

    // Walk back to find `export const NAME =` (or `const NAME =`)
    let lineStart = src.lastIndexOf('\n', startIdx) + 1
    const decl = src.slice(lineStart, startIdx).trimEnd()
    const declMatch = decl.match(/^(\s*)(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*$/)
    if (!declMatch) {
      // Not a top-level declaration — leave as-is and advance.
      out.push(src.slice(i, startIdx + 'createServerFn('.length))
      i = startIdx + 'createServerFn('.length
      continue
    }
    const indent = declMatch[1] || ''
    const exportKw = declMatch[2] || ''
    const name = declMatch[3]

    // Emit everything before the line
    out.push(src.slice(i, lineStart))

    // Find end of the chain: from startIdx, walk to the matching `).handler(...)` then to its closing `)`.
    // Pattern: createServerFn(METHOD_OBJ).inputValidator(VAL_FN)?.handler(HANDLER_FN)
    // We just need to count parens from `createServerFn(` until depth returns to 0,
    // then continue if `.inputValidator(` or `.handler(` follows.
    let p = startIdx + 'createServerFn'.length
    function skipParenGroup(start) {
      // start points at '('
      let depth = 0
      let j = start
      let inStr = null
      let inTpl = false
      let tplDepth = 0
      let inLineComment = false
      let inBlockComment = false
      while (j < N) {
        const ch = src[j]
        const nx = src[j + 1]
        if (inLineComment) {
          if (ch === '\n') inLineComment = false
          j++
          continue
        }
        if (inBlockComment) {
          if (ch === '*' && nx === '/') { inBlockComment = false; j += 2; continue }
          j++
          continue
        }
        if (inStr) {
          if (ch === '\\') { j += 2; continue }
          if (ch === inStr) { inStr = null }
          j++
          continue
        }
        if (inTpl) {
          if (ch === '\\') { j += 2; continue }
          if (ch === '`' && tplDepth === 0) { inTpl = false; j++; continue }
          if (ch === '$' && nx === '{') { tplDepth++; j += 2; continue }
          if (ch === '}' && tplDepth > 0) { tplDepth--; j++; continue }
          j++
          continue
        }
        if (ch === '/' && nx === '/') { inLineComment = true; j += 2; continue }
        if (ch === '/' && nx === '*') { inBlockComment = true; j += 2; continue }
        if (ch === '"' || ch === "'") { inStr = ch; j++; continue }
        if (ch === '`') { inTpl = true; j++; continue }
        if (ch === '(') { depth++; j++; continue }
        if (ch === ')') {
          depth--
          j++
          if (depth === 0) return j
          continue
        }
        j++
      }
      return -1
    }

    // Skip method-object `(...)`
    let methodOpen = src.indexOf('(', p)
    let methodClose = skipParenGroup(methodOpen)
    if (methodClose === -1) { out.push(src.slice(i)); break }
    let cursor = methodClose

    let validatorSource = null
    let handlerSource = null
    let handlerArrowHasArg = false

    // Skip whitespace and read possible chained `.inputValidator(...)`
    function skipWs(j) {
      while (j < N && /\s/.test(src[j])) j++
      return j
    }

    cursor = skipWs(cursor)
    if (src.startsWith('.inputValidator(', cursor)) {
      const open = cursor + '.inputValidator'.length
      const close = skipParenGroup(open)
      if (close === -1) { out.push(src.slice(i)); break }
      validatorSource = src.slice(open + 1, close - 1) // inside parens
      cursor = close
    }

    cursor = skipWs(cursor)
    if (!src.startsWith('.handler(', cursor)) {
      // Unexpected shape — emit as-is and advance.
      out.push(src.slice(lineStart, startIdx + 'createServerFn('.length))
      i = startIdx + 'createServerFn('.length
      continue
    }
    const hOpen = cursor + '.handler'.length
    const hClose = skipParenGroup(hOpen)
    if (hClose === -1) { out.push(src.slice(i)); break }
    handlerSource = src.slice(hOpen + 1, hClose - 1).trim()
    cursor = hClose

    // Optional trailing `)` if author chained more — but we expect just `;` or whitespace.
    // Move past optional `;`
    let endOfStmt = cursor
    while (endOfStmt < N && /[\s;]/.test(src[endOfStmt])) endOfStmt++

    // Parse handler: looks like `async ({ data }) => { BODY }` or `async () => { BODY }`
    // or arrow returning expression.
    const arrowMatch = handlerSource.match(/^async\s*(\([^)]*\))\s*=>\s*([\s\S]+)$/)
    if (!arrowMatch) {
      out.push(src.slice(i)) // bail
      break
    }
    const argList = arrowMatch[1]
    let body = arrowMatch[2].trim()
    handlerArrowHasArg = !/^\(\s*\)$/.test(argList)

    // Detect destructure alias: `({ data: ALIAS })` → bind parsed value to ALIAS, not `data`.
    let bindName = 'data'
    const aliasMatch = argList.match(/^\(\s*\{\s*data\s*:\s*([A-Za-z_$][\w$]*)\s*\}\s*\)$/)
    if (aliasMatch) bindName = aliasMatch[1]

    // If body is `{ ... }` block, keep the braces and use them as fn body. Otherwise wrap as `return <expr>`.
    let fnBody
    if (body.startsWith('{')) {
      // strip outer braces
      // find matching brace
      let depth = 0
      let endJ = -1
      for (let j = 0; j < body.length; j++) {
        const ch = body[j]
        if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) { endJ = j; break } }
      }
      if (endJ === -1) { out.push(src.slice(i)); break }
      fnBody = body.slice(1, endJ)
    } else {
      // expression
      // remove trailing comma if any
      const expr = body.replace(/,\s*$/, '')
      fnBody = `\n  return ${expr}\n`
    }

    // Trim a trailing comma + whitespace from the captured validator source
    // (it shows up because authors write `\n      .parse(data),\n  )` inside the chain).
    let cleanValidator = validatorSource ? validatorSource.replace(/[,\s]+$/, '') : null

    // Always call the function with `_input: unknown` and bind the parsed value to `data`.
    let inputDecl = ''
    let signatureArg = '_input: unknown'
    if (cleanValidator) {
      // Use the handler's destructure alias as the binding name (defaults to `data`).
      // Cast to `any` because the validator's arg type is the parsed shape, not `unknown`.
      inputDecl = `\n  const ${bindName} = (${cleanValidator})(_input as any);\n`
    } else if (handlerArrowHasArg) {
      // handler said `({ data })` but had no validator — bind raw input as `data`.
      inputDecl = `\n  const data = _input as never;\n`
    } else {
      // No arg at all — drop the param to keep the public signature clean.
      signatureArg = ''
    }

    const fnDecl = `${indent}${exportKw}async function ${name}(${signatureArg}) {${inputDecl}${fnBody}\n${indent}}\n`
    out.push(fnDecl)
    i = endOfStmt
  }

  return out.join('')
}

function transform(src) {
  let s = stripUseServer(src)
  s = stripCreateServerFnImport(s)
  s = remapPaths(s)
  s = rewritePathResolve(s)
  s = transformCreateServerFn(s)
  return s
}

let okCount = 0
for (const f of FILES) {
  const srcPath = path.join(SRC_DIR, f)
  const dstPath = path.join(DST_DIR, f)
  const src = readFileSync(srcPath, 'utf8')
  const out = transform(src)
  writeFileSync(dstPath, out, 'utf8')
  okCount++
  console.log(`✓ ${f} (${src.length} → ${out.length} bytes)`)
}
console.log(`\nPorted ${okCount}/${FILES.length} files.`)
