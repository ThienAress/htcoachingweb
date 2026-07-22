import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage();

export const runWithRequestContext = (context, callback) =>
  storage.run(Object.freeze({ ...context }), callback);

export const getRequestContext = () => storage.getStore() || {};
