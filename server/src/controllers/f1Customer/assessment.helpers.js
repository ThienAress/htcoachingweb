const levelToRank = (level = "") => {
  const map = {
    low: 1,
    below_average: 2,
    average: 3,
    good: 4,
  };
  return map[level] || 2;
};

const rankToLevel = (rank = 2) => {
  if (rank <= 1.5) return "low";
  if (rank <= 2.5) return "below_average";
  if (rank <= 3.25) return "average";
  return "good";
};

const averageRanks = (levels = []) => {
  const valid = levels
    .map((item) => levelToRank(item))
    .filter((item) => Number.isFinite(item));

  if (!valid.length) return 2;
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
};

const computePostureLevel = (assessment = {}) => {
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

const computeStrengthLevel = (assessment = {}) => {
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

const computeEnduranceLevel = (assessment = {}) => {
  const endurance = assessment?.enduranceAssessment || {};

  return rankToLevel(
    averageRanks([
      endurance?.muscularEndurance?.level,
      endurance?.coreEndurance?.level,
    ]),
  );
};

const restingHrToLevel = (restingHeartRate) => {
  const hr = Number(restingHeartRate || 0);
  if (!Number.isFinite(hr) || hr <= 0) return "below_average";
  if (hr <= 65) return "good";
  if (hr <= 75) return "average";
  if (hr <= 85) return "below_average";
  return "low";
};

const computeCardioLevel = (assessment = {}) => {
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
