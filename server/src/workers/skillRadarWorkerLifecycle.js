const requiredFunction = (value, name) => {
  if (typeof value !== "function") {
    throw new TypeError(`Skill Radar worker requires ${name}`);
  }
  return value;
};

export const createSkillRadarWorker = (dependencies) => {
  const connect = requiredFunction(dependencies?.connect, "connect");
  const startCron = requiredFunction(dependencies?.startCron, "startCron");
  const stopCron = requiredFunction(dependencies?.stopCron, "stopCron");
  const disconnect = requiredFunction(dependencies?.disconnect, "disconnect");

  let started = false;
  let startPromise = null;
  let stopPromise = null;

  const start = () => {
    if (started) return Promise.resolve(false);
    if (startPromise) return startPromise;

    startPromise = (async () => {
      let connected = false;
      try {
        await connect();
        connected = true;
        await startCron();
        started = true;
        return true;
      } catch (error) {
        if (connected) await disconnect();
        throw error;
      } finally {
        startPromise = null;
      }
    })();
    return startPromise;
  };

  const stop = () => {
    if (stopPromise) return stopPromise;
    if (!started && !startPromise) return Promise.resolve(false);

    stopPromise = (async () => {
      if (startPromise) await startPromise;
      if (!started) return false;

      let failure = null;
      try {
        await stopCron();
      } catch (error) {
        failure = error;
      }
      try {
        await disconnect();
      } catch (error) {
        failure ||= error;
      } finally {
        started = false;
      }
      if (failure) throw failure;
      return true;
    })().finally(() => {
      stopPromise = null;
    });
    return stopPromise;
  };

  return { start, stop };
};
