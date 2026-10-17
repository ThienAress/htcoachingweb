import { Children, Fragment, isValidElement } from "react";

const textOf = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
};

// Đọc các thẻ <option> (kể cả trong Fragment, optgroup hoặc .map) thành danh sách cho RoundedSelect.
export const parseSelectOptions = (children) => {
  const options = [];
  const visit = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment || child.type === "optgroup") {
        visit(child.props.children);
        return;
      }
      if (child.type !== "option") return;
      const { value, children: label, disabled } = child.props;
      options.push({
        value: value === undefined ? textOf(label) : String(value),
        label,
        disabled: Boolean(disabled),
      });
    });
  };
  visit(children);
  return options;
};
