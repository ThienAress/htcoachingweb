import { useState, useMemo, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Image as ImageIcon, Link as LinkIcon,
  AlignLeft, AlignCenter, Undo2, Redo2, Unlink, FileText,
  Maximize2, Minimize2, ImagePlus
} from "lucide-react";

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize: null }).run();
      },
    };
  },
});


const MenuButton = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-md transition-colors ${
      active
        ? "bg-primary text-white"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-slate-200 mx-0.5" />;

const parseMarkdownToHtml = (markdown) => {
  if (!markdown) return "";
  let html = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Phân tích blockquotes (> blockquote)
  html = html.replace(/^\s*>\s+(.*)$/gim, "<blockquote>$1</blockquote>");

  // 2. Phân tích Headings (H1 -> H6)
  html = html.replace(/^\s*######\s+(.*)$/gim, "<h6>$1</h6>");
  html = html.replace(/^\s*#####\s+(.*)$/gim, "<h5>$1</h5>");
  html = html.replace(/^\s*####\s+(.*)$/gim, "<h4>$1</h4>");
  html = html.replace(/^\s*###\s+(.*)$/gim, "<h3>$1</h3>");
  html = html.replace(/^\s*##\s+(.*)$/gim, "<h2>$1</h2>");
  html = html.replace(/^\s*#\s+(.*)$/gim, "<h1>$1</h1>");

  // 3. Phân tích Bold và Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/___(?!_)(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(?!_)(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(?!_)(.+?)_/g, "<em>$1</em>");

  // 4. Phân tích Horizontal Rules (---, ***, ___)
  html = html.replace(/^\s*[-*_]{3,}\s*$/gim, "<hr />");

  // 5. Phân tích Tables
  const lines = html.split("\n");
  let inTable = false;
  let tableHtml = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.split("|").map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);

      // Bỏ qua dòng separator
      if (line.includes("---") || line.includes(":-")) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="border-collapse border border-slate-300 w-full my-4">';
        tableHtml += '<thead class="bg-slate-100"><tr>';
        cells.forEach(cell => {
          tableHtml += `<th class="border border-slate-300 px-3 py-2 text-left font-bold text-sm">${cell}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td class="border border-slate-300 px-3 py-2 text-sm text-slate-600">${cell}</td>`;
        });
        tableHtml += '</tr>';
      }
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += "</tbody></table>";
        lines[i - 1] = tableHtml;
        tableHtml = "";
      }
    }
  }
  if (inTable) {
    tableHtml += "</tbody></table>";
    lines[lines.length - 1] = tableHtml;
  }

  html = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && (trimmed.includes("---") || trimmed.includes(":-") || (!trimmed.includes("<table") && !trimmed.includes("<tr") && !trimmed.includes("<th") && !trimmed.includes("<td") && !trimmed.includes("</table")))) {
      return false;
    }
    return true;
  }).join("\n");

  // 6. Phân tích Lists (Unordered & Ordered)
  const processedLines = html.split("\n");
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i].trim();
    const ulMatch = line.match(/^[*+-]\s+(.*)$/);
    const olMatch = line.match(/^\d+\.\s+(.*)$/);

    if (ulMatch) {
      let content = ulMatch[1];
      if (inOl) {
        processedLines[i - 1] += "</ol>";
        inOl = false;
      }
      if (!inUl) {
        processedLines[i] = "<ul><li>" + content + "</li>";
        inUl = true;
      } else {
        processedLines[i] = "<li>" + content + "</li>";
      }
    } else if (olMatch) {
      let content = olMatch[1];
      if (inUl) {
        processedLines[i - 1] += "</ul>";
        inUl = false;
      }
      if (!inOl) {
        processedLines[i] = "<ol><li>" + content + "</li>";
        inOl = true;
      } else {
        processedLines[i] = "<li>" + content + "</li>";
      }
    } else {
      if (inUl) {
        processedLines[i - 1] += "</ul>";
        inUl = false;
      }
      if (inOl) {
        processedLines[i - 1] += "</ol>";
        inOl = false;
      }
    }
  }

  html = processedLines.join("\n");

  // 7. Phân tích Paragraphs (cho các dòng trống hoặc các dòng text thuần không chứa HTML block)
  const paragraphLines = html.split("\n");
  for (let i = 0; i < paragraphLines.length; i++) {
    const line = paragraphLines[i].trim();
    if (line === "") continue;

    const isBlock = /^(<h[1-6]|<ul|<ol|<li|<blockquote|<table|<tr|<th|<td|<hr|<\/ul|<\/ol|<\/li|<\/blockquote|<\/table|<\/tr|<\/th|<\/td)/i.test(line);
    if (!isBlock) {
      paragraphLines[i] = `<p>${paragraphLines[i]}</p>`;
    }
  }
  html = paragraphLines.filter(line => line.trim() !== "").join("\n");

  return html;
};

const TipTapEditor = ({ content, coverImage, onChange, onImageUpload }) => {
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({
      placeholder: "Bắt đầu viết nội dung bài viết...",
    }),
  ], []);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [, setSelectionTick] = useState(0);
  const updateTimerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const editor = useEditor({
    extensions,
    content: content || "",
    onUpdate: ({ editor: ed }) => {
      setSelectionTick((t) => t + 1);
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        onChange?.(ed.getHTML());
      }, 500);
    },
    onSelectionUpdate: () => {
      setSelectionTick((t) => t + 1);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-lg max-w-none min-h-[400px] p-5 outline-none " +
          "prose-headings:font-black prose-headings:text-slate-900 " +
          "prose-p:text-slate-600 prose-p:leading-relaxed " +
          "prose-a:text-primary prose-strong:text-slate-900 " +
          "prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto prose-img:!mb-3 [&_img+p]:!mt-2 " +
          "prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-xl " +
          "prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic " +
          "prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
      },
      transformPastedHTML(html) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          // 1. Chuyển đổi hoặc loại bỏ thẻ <font> cổ điển thường xuất hiện khi copy từ Word/Excel
          const fontElements = doc.querySelectorAll("font");
          fontElements.forEach((el) => {
            const span = doc.createElement("span");
            span.innerHTML = el.innerHTML;
            el.parentNode.replaceChild(span, el);
          });

          // 2. Loại bỏ các inline style rác trên mọi thẻ (font-size, font-family, color, line-height...)
          const elements = doc.querySelectorAll("[style]");
          elements.forEach((el) => {
            el.style.fontSize = "";
            el.style.fontFamily = "";
            el.style.lineHeight = "";
            el.style.color = "";
            el.style.backgroundColor = "";
            if (!el.getAttribute("style") || el.style.length === 0) {
              el.removeAttribute("style");
            }
          });

          // 3. Loại bỏ class ngoại lai để tránh class rác từ Word/Notion làm hỏng CSS Tailwind của editor
          const classedElements = doc.querySelectorAll("[class]");
          classedElements.forEach((el) => {
            el.removeAttribute("class");
          });

          // 4. Loại bỏ các thẻ rác của Word như style, link, meta, xml
          const trashTags = doc.querySelectorAll("style, link, meta, xml, script");
          trashTags.forEach((el) => el.remove());

          return doc.body.innerHTML;
        } catch {
          return html;
        }
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        // Kiểm tra xem có chứa các cú pháp Markdown cơ bản hay không
        const isMarkdown = text && (
          text.includes("# ") ||
          text.includes("**") ||
          text.includes("* ") ||
          text.includes("---") ||
          text.includes("| ") ||
          text.includes("\n> ")
        );

        if (isMarkdown) {
          event.preventDefault();
          const html = parseMarkdownToHtml(text);
          setTimeout(() => {
            if (editor) {
              editor.commands.insertContent(html);
            }
          }, 0);
          return true; // Chặn hành vi paste text thô mặc định
        }
        return false;
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (file && file.name.endsWith(".md")) {
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target.result;
            const html = parseMarkdownToHtml(text);
            setTimeout(() => {
              if (editor) {
                editor.commands.insertContent(html);
              }
            }, 0);
          };
          reader.readAsText(file);
          return true;
        }
        return false;
      },
    },
  }, []);

  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  const importMarkdownFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const html = parseMarkdownToHtml(text);
        editor.chain().focus().insertContent(html).run();
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const addImage = async () => {
    if (onImageUpload) {
      // Upload qua Cloudinary
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const url = await onImageUpload(file);
          if (url) editor.chain().focus().setImage({ src: url }).run();
        } catch {
          // Error handled by parent
        }
      };
      input.click();
    } else {
      const url = window.prompt("URL hình ảnh:");
      if (url) editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL liên kết:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden transition-all ${
      isFullScreen
        ? "fixed inset-0 z-[999] flex flex-col h-screen w-screen bg-slate-50 rounded-none border-none tiptap-fullscreen"
        : "relative"
    }`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === "default") {
              editor.chain().focus().unsetFontFamily().run();
            } else {
              editor.chain().focus().setFontFamily(val).run();
            }
          }}
          value={editor.getAttributes("textStyle").fontFamily?.replace(/['"]+/g, "") || "default"}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none focus:border-primary transition"
        >
          <option value="default">Font chữ (Mặc định: Poppins)</option>
          <option value="Google Sans">Google Sans</option>
          <option value="Be Vietnam Pro">Be Vietnam Pro</option>
          <option value="Inter">Inter</option>
          <option value="Lora">Lora (Chữ có chân)</option>
          <option value="Roboto">Roboto</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Poppins">Poppins</option>
          <option value="Oswald">Oswald</option>
          <option value="Playfair Display">Playfair Display</option>
          <option value="Merriweather">Merriweather</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>

        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === "default") {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(val).run();
            }
          }}
          value={editor.getAttributes("textStyle").fontSize || "default"}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none focus:border-primary transition"
        >
          <option value="default">Cỡ chữ (Mặc định: 16px)</option>
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="30px">30px</option>
          <option value="36px">36px</option>
          <option value="48px">48px</option>
        </select>

        <Divider />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="In đậm (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="In nghiêng (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Gạch chân (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Gạch ngang"
        >
          <Strikethrough className="w-4 h-4" />
        </MenuButton>

        <Divider />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Tiêu đề lớn (H2)"
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Tiêu đề nhỏ (H3)"
        >
          <Heading3 className="w-4 h-4" />
        </MenuButton>

        <Divider />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Danh sách"
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Danh sách số"
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Trích dẫn"
        >
          <Quote className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Đường kẻ ngang"
        >
          <Minus className="w-4 h-4" />
        </MenuButton>

        <Divider />

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Căn trái"
        >
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Căn giữa"
        >
          <AlignCenter className="w-4 h-4" />
        </MenuButton>

        <Divider />

        <MenuButton onClick={addLink} active={editor.isActive("link")} title="Chèn liên kết">
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        {editor.isActive("link") && (
          <MenuButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Xóa liên kết"
          >
            <Unlink className="w-4 h-4" />
          </MenuButton>
        )}
        <MenuButton onClick={addImage} title="Chèn hình ảnh">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
        {coverImage && (
          <MenuButton
            onClick={() => editor.chain().focus().setImage({ src: coverImage }).run()}
            title="Chèn ảnh bìa vào bài viết"
          >
            <ImagePlus className="w-4 h-4 text-emerald-600" />
          </MenuButton>
        )}
        <MenuButton onClick={importMarkdownFile} title="Nhập từ file Markdown (.md)">
          <FileText className="w-4 h-4 text-primary" />
        </MenuButton>

        <Divider />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Làm lại (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </MenuButton>

        <Divider />

        <MenuButton
          onClick={() => setIsFullScreen(!isFullScreen)}
          active={isFullScreen}
          title={isFullScreen ? "Thu nhỏ (ESC)" : "Toàn màn hình"}
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4 text-primary animate-pulse" /> : <Maximize2 className="w-4 h-4" />}
        </MenuButton>
      </div>

      {/* Editor Area */}
      <div className={isFullScreen ? "flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8" : ""}>
        <div className={isFullScreen ? "max-w-4xl mx-auto bg-white shadow-lg rounded-xl border border-slate-200 min-h-full" : ""}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};

export default TipTapEditor;
