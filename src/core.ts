import assertNever from 'assert-never'
import { Editor, EditorPosition, EditorRange } from 'obsidian'

import { ImgurPluginSettings, NothingSelected } from './setting'

// https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch08s18.html
const win32Path = /^[a-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/i
const unixPath = /^(?:\/[^/]+)+\/?$/i
const testFilePath = (url: string) => win32Path.test(url) || unixPath.test(url)

/**
 * Convert a file path to a file URL
 */
function pathToFileUrl(path: string): string {
  // Convert Windows backslashes to forward slashes
  const normalizedPath = path.replace(/\\/g, '/')
  // Ensure path starts with a slash
  const pathWithSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  // Encode special characters
  const encodedPath = pathWithSlash
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `file://${encodedPath}`
}

/**
 * @param editor Obsidian Editor Instance
 * @param cbString text on clipboard
 * @param settings plugin settings
 * @returns true if the URL paste was handled, false otherwise
 */
export default function UrlIntoSelection(
  editor: Editor,
  cbString: string,
  settings: ImgurPluginSettings,
): boolean
/**
 * @param editor Obsidian Editor Instance
 * @param cbEvent clipboard event
 * @param settings plugin settings
 * @returns true if the URL paste was handled, false otherwise
 */
export default function UrlIntoSelection(
  editor: Editor,
  cbEvent: ClipboardEvent,
  settings: ImgurPluginSettings,
): boolean
export default function UrlIntoSelection(
  editor: Editor,
  cb: string | ClipboardEvent,
  settings: ImgurPluginSettings,
): boolean {
  console.log('UrlIntoSelection called with:', {
    hasSelection: editor.somethingSelected(),
    nothingSelectedSetting: settings.nothingSelected,
    cbType: typeof cb,
  })

  // skip all if nothing should be done
  if (!editor.somethingSelected() && settings.nothingSelected === NothingSelected.doNothing) {
    console.log('Skipping due to no selection and doNothing setting')
    return false
  }

  if (typeof cb !== 'string' && cb.clipboardData === null) {
    console.error('empty clipboardData in ClipboardEvent')
    return false
  }

  const clipboardText = getCbText(cb)
  console.log('Clipboard text:', clipboardText)
  if (clipboardText === null) return false

  const { selectedText, replaceRange } = getSelnRange(editor, settings)
  console.log('Selection info:', { selectedText, replaceRange })

  const replaceText = getReplaceText(clipboardText, selectedText, settings)
  console.log('Replace text result:', replaceText)
  if (replaceText === null) return false

  // apply changes
  if (typeof cb !== 'string') cb.preventDefault() // prevent default paste behavior
  replace(editor, replaceText, replaceRange)

  // if nothing is selected and the nothing selected behavior is to insert [](url) place the cursor between the square brackets
  if (selectedText === '' && settings.nothingSelected === NothingSelected.insertInline) {
    editor.setCursor({ ch: replaceRange.from.ch + 1, line: replaceRange.from.line })
  }

  return true
}

function getSelnRange(editor: Editor, settings: ImgurPluginSettings) {
  let selectedText: string
  let replaceRange: EditorRange | null

  if (editor.somethingSelected()) {
    selectedText = editor.getSelection().trim()
    replaceRange = null
  } else {
    switch (settings.nothingSelected) {
      case NothingSelected.autoSelect:
        replaceRange = getWordBoundaries(editor, settings)
        selectedText = editor.getRange(replaceRange.from, replaceRange.to)
        break
      case NothingSelected.insertInline:
      case NothingSelected.insertBare:
        replaceRange = getCursor(editor)
        selectedText = ''
        break
      case NothingSelected.doNothing:
        throw new Error('should be skipped')
      default:
        assertNever(settings.nothingSelected)
    }
  }
  return { selectedText, replaceRange }
}

function isUrl(text: string, settings: ImgurPluginSettings): boolean {
  console.log('isUrl checking:', { text, regex: settings.regex })
  if (text === '') return false
  try {
    // throw TypeError: Invalid URL if not valid
    new URL(text)
    console.log('Valid URL via URL constructor')
    return true
  } catch {
    // settings.regex: fallback test allows url without protocol (http,file...)
    const isFilePath = testFilePath(text)
    const matchesRegex = new RegExp(settings.regex).test(text)
    console.log('URL validation fallback:', { isFilePath, matchesRegex })
    return isFilePath || matchesRegex
  }
}

/**
 * Validate that either the text on the clipboard or the selected text is a link, and if so return the link as
 * a markdown link with the selected text as the link's text, or, if the value on the clipboard is not a link
 * but the selected text is, the value of the clipboard as the link's text.
 * @param clipboardText text on the clipboard.
 * @param selectedText highlighted text
 * @param settings plugin settings
 * @returns a mardown link or image link if the clipboard or selction value is a valid link, else null.
 */
function getReplaceText(
  clipboardText: string,
  selectedText: string,
  settings: ImgurPluginSettings,
): string | null {
  console.log('getReplaceText called with:', {
    clipboardText,
    selectedText,
    pasteUrlOntoSelection: settings.pasteUrlOntoSelection,
    convertSelectionToHyperlink: settings.convertSelectionToHyperlink,
    nothingSelected: settings.nothingSelected,
  })

  let linktext: string
  let url: string

  if (isUrl(clipboardText, settings)) {
    console.log('Clipboard text is a URL')
    // URL is being pasted
    if (selectedText !== '') {
      console.log('Has selected text')
      // There is selected text
      if (!settings.pasteUrlOntoSelection) {
        console.log('Paste URL onto selection is disabled')
        // If pasting onto selection is disabled, return null to keep original text
        return null
      }
      if (settings.convertSelectionToHyperlink) {
        console.log('Converting to hyperlink')
        // Convert to hyperlink if enabled
        url = processUrl(clipboardText)
        linktext = selectedText
        return `[${linktext}](${url})`
      } else {
        console.log('Not converting to hyperlink, using raw URL')
        // Just paste the URL if disabled
        return clipboardText
      }
    } else {
      console.log('No text selected')
      // No text selected, handle according to nothingSelected setting
      url = processUrl(clipboardText)
      if (settings.nothingSelected === NothingSelected.insertBare) {
        return `<${url}>`
      } else if (settings.nothingSelected === NothingSelected.insertInline) {
        return `[](${url})`
      } else {
        return url
      }
    }
  } else if (isUrl(selectedText, settings)) {
    // Selected text is a URL
    url = processUrl(selectedText)
    linktext = clipboardText
    return `[${linktext}](${url})`
  }

  return null // if neither is a URL
}

/** Process file url, special characters, etc */
function processUrl(src: string): string {
  const output = testFilePath(src) ? pathToFileUrl(src) : src
  const escaped = output.replace(/[<>]/g, (match) => (match === '<' ? '%3C' : '%3E'))
  return /[() ]/.test(escaped) ? `<${escaped}>` : escaped
}

function getCbText(cb: string | ClipboardEvent): string | null {
  let clipboardText: string

  if (typeof cb === 'string') {
    clipboardText = cb
  } else {
    if (!cb.clipboardData) {
      console.error('empty clipboardData in ClipboardEvent')
      return null
    }
    clipboardText = cb.clipboardData.getData('text')
  }
  return clipboardText.trim()
}

function getWordBoundaries(editor: Editor, settings: ImgurPluginSettings): EditorRange {
  const cursor = editor.getCursor()
  const line = editor.getLine(cursor.line)
  const wordBoundaries = findWordAt(line, cursor)

  // If the token the cursor is on is a url, grab the whole thing instead of just parsing it like a word
  let start = wordBoundaries.from.ch
  let end = wordBoundaries.to.ch
  while (start > 0 && !/\s/.test(line.charAt(start - 1))) --start
  while (end < line.length && !/\s/.test(line.charAt(end))) ++end
  if (isUrl(line.slice(start, end), settings)) {
    wordBoundaries.from.ch = start
    wordBoundaries.to.ch = end
  }
  return wordBoundaries
}

const findWordAt = (() => {
  const nonASCIISingleCaseWordChar =
    /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/

  function isWordChar(char: string) {
    return (
      /\w/.test(char) ||
      (char > '\x80' &&
        (char.toUpperCase() !== char.toLowerCase() || nonASCIISingleCaseWordChar.test(char)))
    )
  }

  const findWordAtImpl = (line: string, pos: EditorPosition): EditorRange => {
    let check
    let start = pos.ch
    let end = pos.ch
    if (end === line.length) --start
    else ++end
    const startChar = line.charAt(pos.ch)
    if (isWordChar(startChar)) {
      check = (ch: string) => isWordChar(ch)
    } else if (/\s/.test(startChar)) {
      check = (ch: string) => /\s/.test(ch)
    } else {
      check = (ch: string) => !/\s/.test(ch) && !isWordChar(ch)
    }

    while (start > 0 && check(line.charAt(start - 1))) --start
    while (end < line.length && check(line.charAt(end))) ++end
    return { from: { line: pos.line, ch: start }, to: { line: pos.line, ch: end } }
  }

  return findWordAtImpl
})()

function getCursor(editor: Editor): EditorRange {
  return { from: editor.getCursor(), to: editor.getCursor() }
}

function replace(
  editor: Editor,
  replaceText: string,
  replaceRange: EditorRange | null = null,
): void {
  // replaceRange is only not null when there isn't anything selected.
  if (replaceRange?.from && replaceRange?.to) {
    editor.replaceRange(replaceText, replaceRange.from, replaceRange.to)
  } else {
    editor.replaceSelection(replaceText)
  }
}
