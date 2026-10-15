import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "../components/F1/ConfirmDialog";

// Dùng như window.confirm nhưng hiện hộp thoại đẹp:
//   const { confirm, dialog } = useConfirmDialog();
//   if (!(await confirm({ title, message }))) return;
//   ... render {dialog}
export const useConfirmDialog = () => {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const settle = useCallback((value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setRequest(options);
      }),
    [],
  );

  const dialog = request ? (
    <ConfirmDialog
      {...request}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, dialog };
};
