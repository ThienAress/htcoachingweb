let draining = false;
let drainReason = "";

export const markRuntimeDraining = (reason = "shutdown") => {
  draining = true;
  drainReason = String(reason || "shutdown").slice(0, 80);
};

export const getRuntimeState = () => ({
  draining,
  drainReason,
});

export const resetRuntimeStateForTests = () => {
  draining = false;
  drainReason = "";
};
