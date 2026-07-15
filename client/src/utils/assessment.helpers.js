export const levelToRank = (level = "") => {
  const map = {
    low: 1,
    below_average: 2,
    average: 3,
    good: 4,
  };
  return map[level] || 2;
};

export const rankToLevel = (rank = 2) => {
  if (rank <= 1.5) return "low";
  if (rank <= 2.5) return "below_average";
  if (rank <= 3.25) return "average";
  return "good";
};

export const averageRanks = (levels = []) => {
  const valid = levels
    .map((item) => levelToRank(item))
    .filter((item) => Number.isFinite(item));

  if (!valid.length) return 2;
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
};

export const computePostureLevel = (assessment = {}) => {
  const posture = assessment?.postureAssessment || {};
  const ohsa = assessment?.movementAssessment?.overheadSquat || {};

  const postureIssues = [
    posture.feetAnkles,
    posture.knees,
    posture.lphc,
    posture.shouldersThoracic,
    posture.headNeck,
  ].filter((item) => item && item !== "normal").length;

  const ohsaIssues = [
    ...(ohsa.anterior || []),
    ...(ohsa.lateral || []),
    ...(ohsa.posterior || []),
  ].length;

  const total = postureIssues + ohsaIssues;

  if (total >= 7) return "low";
  if (total >= 4) return "below_average";
  if (total >= 2) return "average";
  return "good";
};

export const computeStrengthLevel = (assessment = {}) => {
  const strength = assessment?.strengthAssessment || {};

  return rankToLevel(
    averageRanks([
      strength?.upperBodyPush?.level,
      strength?.upperBodyPull?.level,
      strength?.lowerBody?.level,
      strength?.coreStrength?.level,
    ]),
  );
};

export const computeEnduranceLevel = (assessment = {}) => {
  const endurance = assessment?.enduranceAssessment || {};

  return rankToLevel(
    averageRanks([
      endurance?.muscularEndurance?.level,
      endurance?.coreEndurance?.level,
    ]),
  );
};

export const restingHrToLevel = (restingHeartRate) => {
  const hr = Number(restingHeartRate || 0);
  if (!Number.isFinite(hr) || hr <= 0) return "below_average";
  if (hr <= 65) return "good";
  if (hr <= 75) return "average";
  if (hr <= 85) return "below_average";
  return "low";
};

export const computeCardioLevel = (assessment = {}) => {
  const cardio = assessment?.cardioAssessment || {};

  return rankToLevel(
    averageRanks([
      cardio?.cardioCapacity?.level,
      cardio?.recoveryHeartRate?.level,
      restingHrToLevel(cardio?.restingHeartRate),
    ]),
  );
};

export const computeOverallPhysicalLevel = (assessment = {}) => {
  const domainLevels = [
    computePostureLevel(assessment),
    computeStrengthLevel(assessment),
    computeEnduranceLevel(assessment),
    computeCardioLevel(assessment),
  ];

  const lowCount = domainLevels.filter((item) => item === "low").length;
  const belowCount = domainLevels.filter(
    (item) => item === "below_average",
  ).length;
  const averageCount = domainLevels.filter((item) => item === "average").length;

  if (lowCount >= 2) return "low";
  if (lowCount >= 1 || belowCount >= 2) return "below_average";
  if (lowCount === 0 && belowCount === 0 && averageCount <= 1) return "good";
  if (averageCount >= 2 || belowCount >= 1) return "average";
  return "good";
};

// --- Shared scoring utilities (used by Strength, Endurance, Cardio sections) ---

export const scoreToLevel = (score) => {
  const value = Number(score || 0);
  if (value < 4) return "low";
  if (value < 6) return "below_average";
  if (value < 8) return "average";
  return "good";
};

export const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;
export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

export const parseRange = (value = "") => {
  const cleaned = String(value).trim();
  if (!cleaned) return { min: null, max: null };
  const parts = cleaned.split("-").map((item) => Number(item.trim()));
  if (parts.length === 2 && parts.every(Number.isFinite))
    return { min: parts[0], max: parts[1] };
  const single = Number(cleaned);
  if (Number.isFinite(single)) return { min: single, max: single };
  return { min: null, max: null };
};

export const extractProtocolOptions = (suggestion) => {
  if (!suggestion) return [];
  if (
    Array.isArray(suggestion.protocolOptions) &&
    suggestion.protocolOptions.length
  )
    return suggestion.protocolOptions;
  const dosage = String(suggestion.dosage || "");
  if (!dosage) return [];
  const options = [];
  const repsMatch = dosage.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*reps/i,
  );
  if (repsMatch) {
    const sets = parseRange(repsMatch[1]);
    const reps = parseRange(repsMatch[2]);
    options.push({
      label: `${repsMatch[1]} hiệp × ${repsMatch[2]} reps`,
      mode: "reps",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: reps.min,
      valueMax: reps.max,
      unit: "reps",
    });
  }
  const timeMatch = dosage.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|vòng|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*(?:giây|s)\b/i,
  );
  if (timeMatch) {
    const sets = parseRange(timeMatch[1]);
    const seconds = parseRange(timeMatch[2]);
    options.push({
      label: `${timeMatch[1]} hiệp × ${timeMatch[2]} giây`,
      mode: "time",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: seconds.min,
      valueMax: seconds.max,
      unit: "seconds",
    });
  }
  return options;
};

export const scoreAgainstProtocol = ({
  selectedProtocol,
  sets,
  reps,
  durationSec,
}) => {
  if (!selectedProtocol || !selectedProtocol.mode) return "";
  const setsMin = Number(selectedProtocol.setsMin || 0);
  const setsMax = Number(selectedProtocol.setsMax || setsMin || 0);
  const valueMin = Number(selectedProtocol.valueMin || 0);
  const valueMax = Number(selectedProtocol.valueMax || valueMin || 0);
  const actualSets = Number(sets || 0);
  const actualValue =
    selectedProtocol.mode === "reps"
      ? Number(reps || 0)
      : Number(durationSec || 0);
  if (!setsMin || !valueMin || !actualSets || !actualValue) return "";
  const baselineSetRatio = clamp(actualSets / setsMin, 0, 1);
  const baselineValueRatio = clamp(actualValue / valueMin, 0, 1);
  const setBonusRange = Math.max(setsMax - setsMin, 0);
  const valueBonusRange = Math.max(valueMax - valueMin, 0);
  const setBonusRatio =
    actualSets <= setsMin
      ? 0
      : setBonusRange === 0
        ? 1
        : clamp((actualSets - setsMin) / setBonusRange, 0, 1);
  const valueBonusRatio =
    actualValue <= valueMin
      ? 0
      : valueBonusRange === 0
        ? 1
        : clamp((actualValue - valueMin) / valueBonusRange, 0, 1);
  const setAxisScore = 0.7 * baselineSetRatio + 0.3 * setBonusRatio;
  const valueAxisScore = 0.7 * baselineValueRatio + 0.3 * valueBonusRatio;
  return String(round1(10 * (0.4 * setAxisScore + 0.6 * valueAxisScore)));
};
