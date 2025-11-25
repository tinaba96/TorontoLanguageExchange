'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 bg-gray-50 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('bold')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        太字
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('italic')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        斜体
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('strike')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        取消線
      </button>
      <div className="w-px bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        見出し
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('bulletList')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        箇条書き
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('orderedList')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        番号付き
      </button>
      <div className="w-px bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('URLを入力してください')
          if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }
        }}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          editor.isActive('link')
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
      >
        リンク
      </button>
      {editor.isActive('link') && (
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
        >
          リンク解除
        </button>
      )}
    </div>
  )
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline hover:text-indigo-800',
        },
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
