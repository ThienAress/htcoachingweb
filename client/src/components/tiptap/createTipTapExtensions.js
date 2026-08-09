import { Extension } from "@tiptap/core";
import { FontFamily } from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

const FontSize = Extension.create({
  name: "fontSize",
  addOptions: () => ({ types: ["textStyle"] }),
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) =>
              attributes.fontSize
                ? { style: `font-size: ${attributes.fontSize}` }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

export const createTipTapExtensions = () => [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
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
  Placeholder.configure({ placeholder: "Bắt đầu viết nội dung bài viết..." }),
  TableKit.configure({
    table: {
      renderWrapper: true,
      HTMLAttributes: {
        class: "w-full min-w-[640px] border-collapse text-left",
      },
    },
    tableHeader: {
      HTMLAttributes: {
        class: "border border-slate-300 bg-slate-100 px-3 py-2 font-bold text-slate-900",
      },
    },
    tableCell: {
      HTMLAttributes: {
        class: "border border-slate-300 px-3 py-2 align-top text-slate-700",
      },
    },
  }),
];
