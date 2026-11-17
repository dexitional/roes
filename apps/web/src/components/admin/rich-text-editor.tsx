// The CMS editor (Tiptap): headings, marks, colour and highlight, alignment,
// lists, quotes, tables, images from the media library, YouTube embeds,
// links, undo/redo, an HTML source view, a fullscreen mode and a live word
// count with reading time. Output is sanitised again on the server.
import { useEffect, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Youtube from '@tiptap/extension-youtube'
import CharacterCount from '@tiptap/extension-character-count'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Columns3,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  Youtube as YoutubeIcon,
} from 'lucide-react'
import { cn } from '@roes/ui'
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '#/components/ui/overlay'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { MediaPicker } from './media-picker'

const COLORS = ['#111111', '#86012a', '#c80345', '#c98817', '#2f8f6b', '#2563eb', '#6b7280', '#ffffff']
const HIGHLIGHTS = ['#fdf0c4', '#fbd5e1', '#d6f5e5', '#dbeafe', '#ede9fe']

function Btn({ onClick, active, disabled, label, children }: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'grid size-8 place-items-center rounded-lg text-foreground/75 transition hover:bg-muted hover:text-foreground disabled:opacity-30 [&_svg]:size-4',
          active && 'bg-primary/10 text-primary',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" />

function LinkButton({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setUrl(editor.getAttributes('link').href ?? '')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Link"
          className={cn('grid size-8 place-items-center rounded-lg text-foreground/75 hover:bg-muted [&_svg]:size-4', editor.isActive('link') && 'bg-primary/10 text-primary')}
        >
          <Link2 />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const href = url.trim()
            if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run()
            else editor.chain().focus().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:|\/)/.test(href) ? href : `https://${href}` }).run()
            setOpen(false)
          }}
        >
          <p className="text-sm font-semibold">Link</p>
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/collections/necklaces or https://…" />
          <p className="text-xs text-muted-foreground">Internal links (starting with /) help SEO: link to collections and products.</p>
          <div className="flex justify-end gap-2">
            {editor.isActive('link') && (
              <Button type="button" variant="ghost" size="sm" onClick={() => (editor.chain().focus().unsetLink().run(), setOpen(false))}>
                <Unlink /> Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function Swatches({ editor, kind }: { editor: Editor; kind: 'color' | 'highlight' }) {
  const list = kind === 'color' ? COLORS : HIGHLIGHTS
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={kind === 'color' ? 'Text colour' : 'Highlight'} className="grid size-8 place-items-center rounded-lg text-foreground/75 hover:bg-muted [&_svg]:size-4">
          {kind === 'color' ? <Palette /> : <Highlighter />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="flex gap-1.5">
          {list.map((c) => (
            <button
              key={c}
              type="button"
              className="size-7 rounded-full border shadow-sm transition hover:scale-110"
              style={{ background: c }}
              aria-label={c}
              onClick={() => (kind === 'color' ? editor.chain().focus().setColor(c).run() : editor.chain().focus().toggleHighlight({ color: c }).run())}
            />
          ))}
          <button
            type="button"
            className="grid size-7 place-items-center rounded-full border text-muted-foreground"
            aria-label="Clear"
            onClick={() => (kind === 'color' ? editor.chain().focus().unsetColor().run() : editor.chain().focus().unsetHighlight().run())}
          >
            <Eraser className="size-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function YoutubeButton({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="YouTube video" className="grid size-8 place-items-center rounded-lg text-foreground/75 hover:bg-muted [&_svg]:size-4">
          <YoutubeIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (url.trim()) editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run()
            setUrl('')
            setOpen(false)
          }}
        >
          <p className="text-sm font-semibold">Embed a YouTube video</p>
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          <Button type="submit" size="sm">
            Embed
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function Toolbar({ editor, source, setSource, full, setFull }: { editor: Editor; source: boolean; setSource: (v: boolean) => void; full: boolean; setFull: (v: boolean) => void }) {
  const [picker, setPicker] = useState(false)
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      h4: e.isActive('heading', { level: 4 }),
      paragraph: e.isActive('paragraph'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      table: e.isActive('table'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur">
      <Btn label="Undo" onClick={() => c().undo().run()} disabled={!s.canUndo || source}>
        <Undo2 />
      </Btn>
      <Btn label="Redo" onClick={() => c().redo().run()} disabled={!s.canRedo || source}>
        <Redo2 />
      </Btn>
      <Sep />
      <Btn label="Paragraph" active={s.paragraph} onClick={() => c().setParagraph().run()}>
        <Pilcrow />
      </Btn>
      <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Btn>
      <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Btn>
      <Btn label="Heading 4" active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()}>
        <Heading4 />
      </Btn>
      <Sep />
      <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
        <Bold />
      </Btn>
      <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </Btn>
      <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
        <Underline />
      </Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
        <Strikethrough />
      </Btn>
      <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>
        <Code />
      </Btn>
      <Swatches editor={editor} kind="color" />
      <Swatches editor={editor} kind="highlight" />
      <LinkButton editor={editor} />
      <Sep />
      <Btn label="Align left" active={s.left} onClick={() => c().setTextAlign('left').run()}>
        <AlignLeft />
      </Btn>
      <Btn label="Centre" active={s.center} onClick={() => c().setTextAlign('center').run()}>
        <AlignCenter />
      </Btn>
      <Btn label="Align right" active={s.right} onClick={() => c().setTextAlign('right').run()}>
        <AlignRight />
      </Btn>
      <Btn label="Justify" active={s.justify} onClick={() => c().setTextAlign('justify').run()}>
        <AlignJustify />
      </Btn>
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
        <List />
      </Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered />
      </Btn>
      <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
        <Quote />
      </Btn>
      <Btn label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}>
        <Code2 />
      </Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>
        <Minus />
      </Btn>
      <Sep />
      <Btn label="Image from media library" onClick={() => setPicker(true)}>
        <ImagePlus />
      </Btn>
      <YoutubeButton editor={editor} />
      <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table2 />
      </Btn>
      {s.table && (
        <>
          <Btn label="Add column" onClick={() => c().addColumnAfter().run()}>
            <Columns3 />
          </Btn>
          <Btn label="Add row" onClick={() => c().addRowAfter().run()}>
            <Rows3 />
          </Btn>
          <Btn label="Delete table" onClick={() => c().deleteTable().run()}>
            <Trash2 />
          </Btn>
        </>
      )}
      <Btn label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}>
        <Eraser />
      </Btn>
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setSource(!source)}
          className={cn('rounded-lg px-2 py-1 font-mono text-xs font-semibold text-foreground/70 hover:bg-muted', source && 'bg-primary/10 text-primary')}
        >
          {'</>'} HTML
        </button>
        <Btn label={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull(!full)}>
          {full ? <Minimize2 /> : <Maximize2 />}
        </Btn>
      </div>
      <MediaPicker
        open={picker}
        onOpenChange={setPicker}
        onSelect={(items) => {
          for (const m of items) c().setImage({ src: m.url, alt: m.alt ?? '' }).run()
        }}
        multiple
      />
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  minHeight = 280,
  className,
}: {
  value: string | null | undefined
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
}) {
  const [source, setSource] = useState(false)
  const [full, setFull] = useState(false)
  const [html, setHtml] = useState(value ?? '')
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } } }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true, modestBranding: true }),
      CharacterCount,
    ],
    content: value ?? '',
    editorProps: { attributes: { class: 'tiptap rich-content px-5 py-4', style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor: e }) => {
      const out = e.isEmpty ? '' : e.getHTML()
      setHtml(out)
      onChange(out)
    },
  })

  // Accept new content from outside (e.g. data loaded after mount).
  useEffect(() => {
    if (editor && value !== undefined && value !== null && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value, { emitUpdate: false })
      setHtml(value)
    }
  }, [value, editor])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  const words = editor?.storage.characterCount?.words?.() ?? 0
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/10', full && 'fixed inset-4 z-50 flex flex-col shadow-2xl', className)}>
      {editor ? <Toolbar editor={editor} source={source} setSource={setSource} full={full} setFull={setFull} /> : <div className="h-11 border-b bg-muted/40" />}
      <div className={cn(full && 'flex-1 overflow-y-auto')}>
        {source ? (
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value)
              onChange(e.target.value)
            }}
            onBlur={() => editor?.commands.setContent(html, { emitUpdate: false })}
            className="block w-full resize-y bg-muted/30 p-4 font-mono text-xs leading-relaxed outline-none"
            style={{ minHeight }}
            spellCheck={false}
          />
        ) : (
          <div className={cn(full && 'mx-auto max-w-3xl')}>
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-1.5 text-[0.7rem] text-muted-foreground">
        <span>
          {words.toLocaleString()} words · {Math.max(1, Math.round(words / 220))} min read
        </span>
        <span>{source ? 'Editing HTML' : 'Tip: type ## for a heading, - for a list'}</span>
      </div>
    </div>
  )
}
