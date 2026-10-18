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
  const visit = (nodes, group) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        visit(child.props.children, group);
        return;
      }
      if (child.type === "optgroup") {
        visit(child.props.children, child.props.label);
        return;
      }
      if (child.type !== "option") return;
      const { value, children: label, disabled, hidden } = child.props;
      options.push({
        value: value === undefined ? textOf(label) : String(value),
        label,
        disabled: Boolean(disabled),
        ...(hidden ? { hidden: true } : {}),
        ...(group ? { group } : {}),
      });
    });
  };
  visit(children);
  return options;
};
