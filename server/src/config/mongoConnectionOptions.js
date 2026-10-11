const productionOptions = Object.freeze({
  autoIndex: false,
  readPreference: "primary",
  readConcern: Object.freeze({ level: "majority" }),
  writeConcern: Object.freeze({ w: "majority", journal: true }),
  retryReads: true,
  retryWrites: true,
});

export const resolveMongoConnectionOptions = ({
  nodeEnv = process.env.NODE_ENV,
  appEnv = process.env.APP_ENV,
  durable = false,
  autoIndex = nodeEnv !== "production" && appEnv !== "production",
} = {}) => {
  if (!durable && nodeEnv !== "production" && appEnv !== "production") {
    return { autoIndex };
  }

  return {
    ...productionOptions,
    readConcern: { ...productionOptions.readConcern },
    writeConcern: { ...productionOptions.writeConcern },
  };
};
