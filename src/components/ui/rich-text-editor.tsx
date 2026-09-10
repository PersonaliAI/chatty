"use client";

import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Markdown } from "tiptap-markdown";
import {
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Underline as UnderlineIcon,
  Highlighter,
  Link as LinkIcon,
  Unlink,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  Plus,
  Minus,
  ChevronDown,
  SquareCode,
  Trash2,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing your guide...",
  className = "",
}: RichTextEditorProps) {
  const [headingDropdownOpen, setHeadingDropdownOpen] = useState(false);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const headingDropdownRef = useRef<HTMLDivElement>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (headingDropdownRef.current && !headingDropdownRef.current.contains(target)) {
        setHeadingDropdownOpen(false);
      }
      if (addDropdownRef.current && !addDropdownRef.current.contains(target)) {
        setAddDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class:
              "rounded-xl bg-neutral-900 dark:bg-[#0e0f12] text-neutral-100 p-4 font-mono text-xs my-4 border border-neutral-800 overflow-x-auto",
          },
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class:
            "bg-amber-100/90 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-md border border-amber-300/60 dark:border-amber-700/50 font-medium",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Subscript,
      Superscript,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            "text-[#f97316] underline underline-offset-2 font-medium hover:opacity-80 cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const md = (editor.storage as any).markdown?.getMarkdown() || editor.getHTML();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-editor-content prose prose-sm dark:prose-invert max-w-none min-h-[360px] p-6 focus:outline-none text-sm leading-relaxed text-neutral-800 dark:text-neutral-200",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentMd = (editor.storage as any).markdown?.getMarkdown() || "";
    if (content !== currentMd && !editor.isFocused) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl min-h-[360px] flex items-center justify-center text-xs text-neutral-400 bg-white dark:bg-[#131417]">
        Loading editor...
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Button style matching Tiptap's sleek dark/light Simple Editor template
  const getBtnClass = (isActive: boolean, disabled: boolean = false) => {
    if (disabled) {
      return "p-1.5 rounded-lg text-neutral-300 dark:text-neutral-700 cursor-not-allowed transition-colors text-xs flex items-center justify-center";
    }
    if (isActive) {
      return "p-1.5 rounded-lg bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold transition-colors text-xs flex items-center justify-center shadow-xs border border-neutral-300/40 dark:border-neutral-700/60 cursor-pointer";
    }
    return "p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors text-xs flex items-center justify-center cursor-pointer";
  };

  const getHeadingLabel = () => {
    if (editor.isActive("heading", { level: 1 })) return "H1";
    if (editor.isActive("heading", { level: 2 })) return "H2";
    if (editor.isActive("heading", { level: 3 })) return "H3";
    return "H";
  };

  return (
    <div
      className={`border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-[#131417] flex flex-col shadow-sm transition-colors ${className}`}
    >
      {/* -- Sleek Tiptap Simple Editor Toolbar -- */}
      <div className="bg-neutral-50/90 dark:bg-[#18191d] px-3 py-2 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center gap-1 flex-wrap select-none sticky top-0 z-10 backdrop-blur-sm">
        {/* History Group (Undo, Redo) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={getBtnClass(false, !editor.can().undo())}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={getBtnClass(false, !editor.can().redo())}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

        {/* Hierarchy Dropdown (H v) */}
        <div className="relative" ref={headingDropdownRef}>
          <button
            type="button"
            onClick={() => setHeadingDropdownOpen((v) => !v)}
            className={`${getBtnClass(
              editor.isActive("heading"),
              false
            )} gap-1 px-2 font-bold text-[11px]`}
            title="Text Style / Heading"
          >
            <span>{getHeadingLabel()}</span>
            <ChevronDown className="size-3 text-neutral-400" />
          </button>

          {headingDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 w-40 bg-white dark:bg-[#1c1d22] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1 animate-in fade-in-50 zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setHeadingDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  !editor.isActive("heading")
                    ? "bg-neutral-100 dark:bg-neutral-800 text-[#f97316] font-bold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                <Type className="size-3.5" />
                <span>Normal Text</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  setHeadingDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  editor.isActive("heading", { level: 1 })
                    ? "bg-neutral-100 dark:bg-neutral-800 text-[#f97316] font-bold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                <Heading1 className="size-3.5" />
                <span className="font-bold">Heading 1</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setHeadingDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  editor.isActive("heading", { level: 2 })
                    ? "bg-neutral-100 dark:bg-neutral-800 text-[#f97316] font-bold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                <Heading2 className="size-3.5" />
                <span className="font-semibold">Heading 2</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  setHeadingDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  editor.isActive("heading", { level: 3 })
                    ? "bg-neutral-100 dark:bg-neutral-800 text-[#f97316] font-bold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                <Heading3 className="size-3.5" />
                <span>Heading 3</span>
              </button>
            </div>
          )}
        </div>

        {/* Lists & Blockquote */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={getBtnClass(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={getBtnClass(editor.isActive("orderedList"))}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={getBtnClass(editor.isActive("blockquote"))}
          title="Blockquote"
        >
          <Quote className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

        {/* Inline Formatting (B, I, S, </>, U, Highlighter, Link, x2, x2) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={getBtnClass(editor.isActive("bold"))}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={getBtnClass(editor.isActive("italic"))}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={getBtnClass(editor.isActive("strike"))}
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={getBtnClass(editor.isActive("code"))}
          title="Inline Code"
        >
          <Code className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={getBtnClass(editor.isActive("underline"))}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={getBtnClass(editor.isActive("highlight"))}
          title="Highlight Text"
        >
          <Highlighter className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={setLink}
          className={getBtnClass(editor.isActive("link"))}
          title="Insert / Edit Link"
        >
          <LinkIcon className="size-3.5" />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={getBtnClass(false)}
            title="Remove Link"
          >
            <Unlink className="size-3.5 text-red-500" />
          </button>
        )}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={getBtnClass(editor.isActive("superscript"))}
          title="Superscript (x2)"
        >
          <SuperscriptIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={getBtnClass(editor.isActive("subscript"))}
          title="Subscript (x2)"
        >
          <SubscriptIcon className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

        {/* Alignments (Left, Center, Right, Justify) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={getBtnClass(editor.isActive({ textAlign: "left" }))}
          title="Align Left"
        >
          <AlignLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={getBtnClass(editor.isActive({ textAlign: "center" }))}
          title="Align Center"
        >
          <AlignCenter className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={getBtnClass(editor.isActive({ textAlign: "right" }))}
          title="Align Right"
        >
          <AlignRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={getBtnClass(editor.isActive({ textAlign: "justify" }))}
          title="Align Justify"
        >
          <AlignJustify className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

        {/* Quick + Add Insert Menu */}
        <div className="relative" ref={addDropdownRef}>
          <button
            type="button"
            onClick={() => setAddDropdownOpen((v) => !v)}
            className={`${getBtnClass(
              false
            )} gap-1 px-2 font-medium text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white`}
            title="Insert Block Elements"
          >
            <Plus className="size-3" />
            <span>Add</span>
          </button>

          {addDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 w-48 bg-white dark:bg-[#1c1d22] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1 animate-in fade-in-50 zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleCodeBlock().run();
                  setAddDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
              >
                <SquareCode className="size-3.5 text-neutral-400" />
                <span>Code Block</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setHorizontalRule().run();
                  setAddDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
              >
                <Minus className="size-3.5 text-neutral-400" />
                <span>Divider (Line)</span>
              </button>
              <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetAllMarks().clearNodes().run();
                  setAddDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
              >
                <Trash2 className="size-3.5" />
                <span>Clear Formatting</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* -- Editor Content Surface -- */}
      <div className="flex-1 overflow-y-auto cursor-text bg-white dark:bg-[#131417]">
        <EditorContent editor={editor} />
      </div>

      {/* -- Sleek Bottom Footer Info -- */}
      <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-[#16171b] flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 select-none">
        <span className="flex items-center gap-2 font-mono text-[10px]">
          <span>Markdown & HTML enabled</span>
        </span>
        <span className="font-mono text-[10px]">
          {editor.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0} words
        </span>
      </div>
    </div>
  );
}
