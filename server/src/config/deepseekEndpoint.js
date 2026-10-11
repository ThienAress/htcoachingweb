export const DEEPSEEK_TRIAL_MODEL = "deepseek-flash";

const profiles = new Map([
  ["official", {
    url: "https://api.deepseek.com/chat/completions",
    model: DEEPSEEK_TRIAL_MODEL,
  }],
  ["vibi", {
    url: "https://vibi.top/v1/chat/completions",
    model: "deepseek-v4.1-flash",
  }],
]);

export const resolveDeepseekEndpoint = (env = process.env) => {
  const profile = env.DEEPSEEK_ENDPOINT_PROFILE || "official";
  const endpoint = profiles.get(profile);
  const model = env.DEEPSEEK_MODEL || DEEPSEEK_TRIAL_MODEL;
  if (!endpoint || endpoint.model !== model) return null;
  return { ...endpoint, profile };
};
